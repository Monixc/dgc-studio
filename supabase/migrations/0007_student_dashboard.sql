-- 학생 대시보드용 스키마: 포인트, 쪽지, 공지사항, 학사 일정.

-- ── problems.points (문제 만점 시 지급 포인트) ─────────────────
alter table public.problems add column points integer not null default 0;

-- ── points_ledger (자동+수동 지급 이력) ────────────────────────
create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  reason text not null default '',
  problem_id uuid references public.problems(id) on delete set null,
  awarded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.points_ledger enable row level security;

create policy "points_ledger readable by authenticated"
  on public.points_ledger for select
  to authenticated using (true);
create policy "points_ledger insert by teacher"
  on public.points_ledger for insert
  to authenticated with check (awarded_by = auth.uid() and public.is_teacher());

-- 제출 만점 달성 시 자동 지급(문제·학생당 1회, 클라이언트 우회 방지 위해 DB 트리거)
create function public.award_points_on_submission()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  reward integer;
begin
  if new.max_score > 0 and new.score = new.max_score then
    select points into reward from public.problems where id = new.problem_id;
    if reward is not null and reward > 0 and not exists (
      select 1 from public.points_ledger
      where student_id = new.user_id and problem_id = new.problem_id and awarded_by is null
    ) then
      insert into public.points_ledger (student_id, amount, reason, problem_id)
      values (new.user_id, reward, '문제 만점 달성', new.problem_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger on_submission_award_points
  after insert on public.submissions
  for each row execute function public.award_points_on_submission();

-- ── class_students / class_problems: 학생 본인 조회 허용 (기존 선생님 정책은 유지) ──
create policy "class_students select own"
  on public.class_students for select
  to authenticated using (student_id = auth.uid());

create policy "class_problems select via enrollment"
  on public.class_problems for select
  to authenticated using (
    exists (
      select 1 from public.class_students cs
      where cs.class_id = class_problems.class_id and cs.student_id = auth.uid()
    )
  );

-- ── messages (양방향 쪽지) ──────────────────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "messages select own"
  on public.messages for select
  to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "messages insert own"
  on public.messages for insert
  to authenticated with check (sender_id = auth.uid());
create policy "messages update recipient read"
  on public.messages for update
  to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ── academic_events (학사 일정, 선생님 등록 · 전체 학생 열람) ───
create table public.academic_events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null default '',
  description text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.academic_events enable row level security;

create policy "academic_events readable by authenticated"
  on public.academic_events for select
  to authenticated using (true);
create policy "academic_events insert own teacher"
  on public.academic_events for insert
  to authenticated with check (created_by = auth.uid() and public.is_teacher());
create policy "academic_events update own"
  on public.academic_events for update
  to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "academic_events delete own"
  on public.academic_events for delete
  to authenticated using (created_by = auth.uid());

-- ── announcements (공지사항, 선생님 등록 · 전체 학생 열람) ──────
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "announcements readable by authenticated"
  on public.announcements for select
  to authenticated using (true);
create policy "announcements insert own teacher"
  on public.announcements for insert
  to authenticated with check (created_by = auth.uid() and public.is_teacher());
create policy "announcements delete own"
  on public.announcements for delete
  to authenticated using (created_by = auth.uid());

notify pgrst, 'reload schema';
