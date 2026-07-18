-- 보안 감사(flowpy-audit) 후속 조치: SEC-2 / SEC-3 / SEC-4 / SEC-6.
-- SEC-1(서버 채점)·SEC-5(profiles SELECT 스코프)는 프론트/광범위 파급으로 별도 진행.

-- ── 공통 헬퍼: 교사가 해당 학생을 (자기 반에서) 담당하는가 ──────────
-- SECURITY DEFINER로 classes/class_students RLS 우회 → 정책 재귀 회피(0027 패턴).
create function public.teaches_student(p_teacher_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.class_students cs on cs.class_id = c.id
    where c.created_by = p_teacher_id
      and cs.student_id = p_student_id
  );
$$;

revoke all on function public.teaches_student(uuid, uuid) from public;
grant execute on function public.teaches_student(uuid, uuid) to authenticated;

-- ── SEC-3: student_management_notes 를 담당 교사로 스코프 ──────────
-- 기존: for all using(is_teacher()) → 임의 교사가 전체 학생 PII 접근.
drop policy if exists "student notes teacher only" on public.student_management_notes;

create policy "student notes managing teacher"
  on public.student_management_notes for all
  to authenticated
  using (public.teaches_student(auth.uid(), student_id))
  with check (public.teaches_student(auth.uid(), student_id));

-- ── SEC-6: 학생 쪽지는 자기 담당 교사에게만 ──────────────────────
-- 학생 경로만 강화(교사 경로는 그대로). 클라 listStudentTeachers 동작과 일치.
drop policy if exists "messages insert own with student teacher restriction" on public.messages;

create policy "messages insert scoped to relationship"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_teacher()
      or public.teaches_student(recipient_id, auth.uid())
    )
  );

-- ── SEC-4: claim_teacher 시도 제한(사용자당 시간당 5회) ────────────
create table public.claim_teacher_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  window_start timestamptz not null default now()
);
alter table public.claim_teacher_attempts enable row level security;
-- 정책 없음 = 클라 직접 접근 불가(아래 SECURITY DEFINER 함수만 접근).

create or replace function public.claim_teacher(code text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
  uid uuid := auth.uid();
  tries integer;
  win_start timestamptz;
begin
  if uid is null then
    return false;
  end if;

  -- 사용자별 직렬화(카운터 경쟁 방지)
  perform pg_advisory_xact_lock(hashtextextended('claim_teacher:' || uid::text, 0));

  insert into public.claim_teacher_attempts (user_id) values (uid)
    on conflict (user_id) do nothing;
  select attempts, window_start into tries, win_start
    from public.claim_teacher_attempts where user_id = uid;

  -- 1시간 창 리셋
  if win_start < now() - interval '1 hour' then
    update public.claim_teacher_attempts set attempts = 0, window_start = now() where user_id = uid;
    tries := 0;
  end if;

  if tries >= 5 then
    raise exception '시도가 너무 많습니다. 잠시 후 다시 시도하세요.';
  end if;

  select value into expected from public.app_config where key = 'teacher_code';
  if expected is null or code is null or code <> expected then
    update public.claim_teacher_attempts set attempts = attempts + 1 where user_id = uid;
    return false;
  end if;

  update public.profiles set role = 'teacher' where id = uid;
  update public.claim_teacher_attempts set attempts = 0, window_start = now() where user_id = uid;
  return true;
end;
$$;
-- 운영 주의: teacher_code(app_config)를 길고 랜덤한 값으로 회전 권장(감사 SEC-4).

-- ── SEC-2: 타자 포인트 일일 상한(파밍 방지) ──────────────────────
-- 기존 10초 쿨다운만으론 스크립트 채굴 가능. 서버 결과행 바인딩이 불가한
-- practice/race_* 모드에 하루 상한을 둔다. ai_competition은 매치 검증됨(무관).
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
  daily_cap constant integer := 150;  -- ponytail: 고정 상한, 학년/난이도별 튜닝 필요하면 app_config로 이동
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

  -- SEC-2: 오늘 이미 얻은 타자 포인트 합산(UTC 일 경계) → 상한 초과분은 미지급
  select coalesce(sum(points), 0) into earned_today
  from public.typing_practice_logs
  where student_id = uid and completed_at >= date_trunc('day', now());

  if earned_today >= daily_cap then
    -- 상한 도달: 활동 로그는 남기되 포인트 0
    insert into public.typing_practice_logs (student_id, mode, taja, points, match_id)
    values (uid, p_mode, least(greatest(coalesce(p_taja, 0), 0), 5000), 0, p_match_id);
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
  values (uid, p_mode, least(greatest(coalesce(p_taja, 0), 0), 5000), reward, p_match_id);

  insert into public.points_ledger (student_id, amount, reason)
  values (uid, reward, reason_text);

  return reward;
end;
$$;

revoke all on function public.complete_typing_practice(text, integer, boolean, uuid) from public;
grant execute on function public.complete_typing_practice(text, integer, boolean, uuid) to authenticated;

notify pgrst, 'reload schema';
