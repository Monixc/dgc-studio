-- 타자 연습 완료 로그와 포인트를 서버에서 원자적으로 지급한다.

alter table public.typing_practice_logs
  drop constraint if exists typing_practice_logs_mode_check;

alter table public.typing_practice_logs
  add constraint typing_practice_logs_mode_check check (
    mode in (
      'practice',
      'practice_english',
      'practice_code',
      'race_live',
      'race_ghost',
      'ai_learning',
      'ai_competition'
    )
  );

alter table public.typing_practice_logs
  add column match_id uuid references public.typing_ai_lab_matches(id) on delete set null;

create unique index typing_practice_logs_ai_match_student_idx
  on public.typing_practice_logs (match_id, student_id)
  where match_id is not null;

drop policy if exists "typing_practice_logs insert own student"
  on public.typing_practice_logs;

create or replace function public.complete_typing_practice(
  p_mode text,
  p_taja integer,
  p_won boolean default false,
  p_match_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  reward integer;
  reason_text text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = uid and role = 'student'
  ) then
    raise exception 'student only';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  if exists (
    select 1 from public.typing_practice_logs
    where student_id = uid
      and mode = p_mode
      and completed_at > now() - interval '10 seconds'
  ) then
    raise exception 'duplicate completion';
  end if;

  reward := case p_mode
    when 'race_live' then 10 + case when p_won then 5 else 0 end
    when 'ai_competition' then 10
    when 'practice_code' then 7
    when 'race_ghost' then 5
    when 'ai_learning' then 5
    when 'practice_english' then 3
    when 'practice' then 3
    else null
  end;

  if reward is null then
    raise exception 'invalid typing mode';
  end if;

  if p_mode = 'ai_competition' and (
    p_match_id is null or not exists (
      select 1 from public.typing_ai_lab_match_players
      where match_id = p_match_id and user_id = uid
    )
  ) then
    raise exception 'invalid AI competition match';
  end if;

  if p_mode <> 'ai_competition' then
    p_match_id := null;
  end if;

  reason_text := case p_mode
    when 'race_live' then '라이브 레이싱 완료'
    when 'ai_competition' then 'AI 연구소 실시간 경쟁 완료'
    when 'practice_code' then '코드 타자 연습 완료'
    when 'race_ghost' then '고스트 레이싱 완료'
    when 'ai_learning' then 'AI 연구소 개인 학습 완료'
    else '일반 영타 연습 완료'
  end;

  if p_won and p_mode in ('race_live', 'ai_competition') then
    reason_text := reason_text || ' (승리)';
  end if;

  insert into public.typing_practice_logs (student_id, mode, taja, points, match_id)
  values (uid, p_mode, least(greatest(coalesce(p_taja, 0), 0), 5000), reward, p_match_id);

  insert into public.points_ledger (student_id, amount, reason)
  values (uid, reward, reason_text);

  return reward;
end;
$$;

-- AI 경쟁은 두 참가자의 점수가 확정된 뒤 서버가 승자를 판정해 5P를 추가한다.
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
        update public.typing_practice_logs
        set points = points + 5
        where id = (
          select id from public.typing_practice_logs
          where match_id = p_match_id and student_id = winner.user_id
          limit 1
        );

        if found then
          insert into public.points_ledger (student_id, amount, reason)
          values (winner.user_id, 5, 'AI 연구소 실시간 경쟁 승리');
        end if;
      end loop;
    end if;
  end if;
end;
$$;

revoke all on function public.complete_typing_practice(text, integer, boolean, uuid) from public;
grant execute on function public.complete_typing_practice(text, integer, boolean, uuid) to authenticated;

notify pgrst, 'reload schema';
