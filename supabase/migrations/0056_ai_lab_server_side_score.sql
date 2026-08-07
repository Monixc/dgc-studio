-- 잔여 위험: typing_ai_lab_finish_match가 total_score/grade를 클라이언트가 보낸 값
-- 그대로 저장해서, 콘솔에서 total_score를 조작하면 항상 "승리"로 만들 수 있었다
-- (포인트 채굴은 0055에서 막았지만 승패 표시/등급 자체는 여전히 위조 가능했음).
-- computeScore()의 가중합 공식 자체는 순수 산술이라 서버에서 그대로 재현 가능하므로,
-- 각 항목 점수(0~100 스케일)를 따로 받아 total/grade를 서버가 직접 계산하고
-- 클라이언트가 보낸 total_score/grade는 무시한다. (항목 점수 자체의 진위—즉 실제로
-- 그 밀도/커버리지/추론을 달성했는지—까지는 검증하지 않는다. 이건 게임 상태 전체를
-- 서버에서 재생해야 하는 별도 범위의 작업이라 남겨둔다.)

drop function if exists public.typing_ai_lab_finish_match(uuid, numeric, text, integer, uuid, boolean);

create or replace function public.typing_ai_lab_finish_match(
  p_match_id uuid,
  p_total_score numeric,
  p_grade text,
  p_dataset_size integer,
  p_accuracy_score numeric default 0,
  p_dataset_score numeric default 0,
  p_density_score numeric default 0,
  p_coverage_score numeric default 0,
  p_inference_score numeric default 0,
  p_result_id uuid default null,
  p_forfeit boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  remaining integer;
  match_closed boolean := false;
  winner record;
  winner_earned_today integer;
  winner_bonus integer;
  daily_cap constant integer := 150;
  acc numeric;
  ds numeric;
  den numeric;
  cov numeric;
  inf numeric;
  server_total numeric;
  server_grade text;
begin
  acc := greatest(0, least(100, coalesce(p_accuracy_score, 0)));
  ds := greatest(0, least(100, coalesce(p_dataset_score, 0)));
  den := greatest(0, least(100, coalesce(p_density_score, 0)));
  cov := greatest(0, least(100, coalesce(p_coverage_score, 0)));
  inf := greatest(0, least(100, coalesce(p_inference_score, 0)));

  server_total := round(
    (acc * 0.15 + ds * 0.15 + den * 0.2 + cov * 0.15 + inf * 0.35)::numeric, 1
  );
  server_grade := case
    when server_total >= 95 then 'SSS'
    when server_total >= 90 then 'SS'
    when server_total >= 80 then 'S'
    when server_total >= 70 then 'A'
    when server_total >= 60 then 'B'
    when server_total >= 50 then 'C'
    else 'D'
  end;

  update public.typing_ai_lab_match_players
  set total_score = server_total,
      grade = server_grade,
      dataset_size = p_dataset_size,
      result_id = p_result_id,
      forfeit = p_forfeit
  where match_id = p_match_id and user_id = uid;

  select count(*) into remaining
  from public.typing_ai_lab_match_players
  where match_id = p_match_id and total_score is null and forfeit = false;

  if remaining = 0 then
    update public.typing_ai_lab_matches
    set status = 'finished', finished_at = now()
    where id = p_match_id and status <> 'finished'
    returning true into match_closed;

    if match_closed then
      for winner in
        select user_id
        from public.typing_ai_lab_match_players
        where match_id = p_match_id
          and forfeit = false
          and total_score = (
            select max(total_score)
            from public.typing_ai_lab_match_players
            where match_id = p_match_id and forfeit = false
          )
      loop
        perform pg_advisory_xact_lock(hashtextextended(winner.user_id::text, 0));

        select coalesce(sum(points), 0) into winner_earned_today
        from public.typing_practice_logs
        where student_id = winner.user_id and completed_at >= date_trunc('day', now());

        winner_bonus := least(5, greatest(0, daily_cap - winner_earned_today));
        if winner_bonus <= 0 then
          continue;
        end if;

        update public.typing_practice_logs
        set points = points + winner_bonus
        where id = (
          select id from public.typing_practice_logs
          where match_id = p_match_id and student_id = winner.user_id
          limit 1
        );

        if found then
          insert into public.points_ledger (student_id, amount, reason)
          values (winner.user_id, winner_bonus, 'AI 연구소 실시간 경쟁 승리');
        end if;
      end loop;
    end if;
  end if;
end;
$$;

revoke all on function public.typing_ai_lab_finish_match(uuid, numeric, text, integer, numeric, numeric, numeric, numeric, numeric, uuid, boolean) from public;
grant execute on function public.typing_ai_lab_finish_match(uuid, numeric, text, integer, numeric, numeric, numeric, numeric, numeric, uuid, boolean) to authenticated;

create or replace function public.typing_ai_lab_forfeit_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.typing_ai_lab_finish_match(p_match_id, 0, 'D', 0, 0, 0, 0, 0, 0, null, true);
  update public.typing_ai_lab_matches
  set status = 'abandoned', finished_at = now()
  where id = p_match_id and status in ('countdown', 'playing');
end;
$$;

revoke all on function public.typing_ai_lab_forfeit_match(uuid) from public;
grant execute on function public.typing_ai_lab_forfeit_match(uuid) to authenticated;

notify pgrst, 'reload schema';
