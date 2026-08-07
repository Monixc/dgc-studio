-- 클라이언트 렌더 지연(키 연타 중 elapsedMs state가 실제 시간보다 뒤처짐)으로
-- 순간적으로 비현실적인 타수(수천~수만)가 계산되던 버그가 있었다. 클라이언트는
-- 고쳤지만(실시간 계산을 Date.now() 기준으로 변경), 서버는 클라이언트가 보내는
-- 값을 그대로 신뢰할 수 없는 경계이므로 사람이 낼 수 있는 상한(약 300WPM)으로
-- 한 번 더 clamp한다. 기존 5000 상한은 너무 느슨했다.
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
  earned_today integer;
  daily_cap constant integer := 150;
  max_taja constant integer := 1500;
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

  select coalesce(sum(points), 0) into earned_today
  from public.typing_practice_logs
  where student_id = uid and completed_at >= date_trunc('day', now());

  if earned_today >= daily_cap then
    insert into public.typing_practice_logs (student_id, mode, taja, points, match_id)
    values (uid, p_mode, least(greatest(coalesce(p_taja, 0), 0), max_taja), 0, p_match_id);
    return 0;
  end if;
  reward := least(reward, daily_cap - earned_today);

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
  values (uid, p_mode, least(greatest(coalesce(p_taja, 0), 0), max_taja), reward, p_match_id);

  insert into public.points_ledger (student_id, amount, reason)
  values (uid, reward, reason_text);

  return reward;
end;
$$;

revoke all on function public.complete_typing_practice(text, integer, boolean, uuid) from public;
grant execute on function public.complete_typing_practice(text, integer, boolean, uuid) to authenticated;

notify pgrst, 'reload schema';
