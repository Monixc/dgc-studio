-- typing_ai_lab_finish_match의 승자 보너스(+5P)는 complete_typing_practice를 거치지 않고
-- typing_practice_logs.points를 직접 올려서, 그 함수에 있는 일일 150P 상한이 적용되지 않았다.
-- p_total_score는 클라이언트가 그대로 보내는 값이라 항상 자기 자신을 승자로 조작해 매치를
-- 반복하면 무제한으로 포인트를 채굴할 수 있었다. 승자 보너스도 동일한 일일 상한을 적용한다.
create or replace function public.typing_ai_lab_finish_match(
  p_match_id uuid,
  p_total_score numeric,
  p_grade text,
  p_dataset_size integer,
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
begin
  update public.typing_ai_lab_match_players
  set total_score = p_total_score,
      grade = p_grade,
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

revoke all on function public.typing_ai_lab_finish_match(uuid, numeric, text, integer, uuid, boolean) from public;
grant execute on function public.typing_ai_lab_finish_match(uuid, numeric, text, integer, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
