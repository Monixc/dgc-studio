-- Flow-Py v2 초기 스키마
-- 인증: Supabase Auth(auth.users). 권한: profiles.role + RLS.

-- ── profiles ────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now()
);

-- 신규 auth 유저 가입 시 profile 자동 생성 (role=student 고정)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 현재 유저가 선생인지 (RLS 정책에서 profiles 재귀 피하려 SECURITY DEFINER)
create function public.is_teacher()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'teacher'
  );
$$;

-- ── app_config (선생 가입 코드 등, 서버에만 존재) ─────────────
create table public.app_config (
  key text primary key,
  value text not null
);

-- 선생 승격: 코드 일치 시 role=teacher 로 변경
create function public.claim_teacher(code text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  expected text;
begin
  select value into expected from public.app_config where key = 'teacher_code';
  if expected is null or code is null or code <> expected then
    return false;
  end if;
  update public.profiles set role = 'teacher' where id = auth.uid();
  return true;
end;
$$;

-- ── problems ────────────────────────────────────────────────
create table public.problems (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  description text not null default '',
  -- { dsl: string, positions?: { [nodeId]: {x,y} } }
  flowchart jsonb not null default '{"dsl":"","positions":{}}'::jsonb,
  starter_code text not null default '',
  grading_tests jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── submissions ─────────────────────────────────────────────
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null default '',
  result text not null default '',
  score integer not null default 0,
  max_score integer not null default 0,
  passed_tests integer not null default 0,
  total_tests integer not null default 0,
  grading_details jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now()
);

-- ── RLS ─────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.app_config enable row level security;
alter table public.problems enable row level security;
alter table public.submissions enable row level security;

-- profiles: 인증 유저는 display_name/role 조회 가능(선생 제출현황에 학생 이름 필요). 직접 쓰기 불가(트리거·RPC 경유).
create policy "profiles readable by authenticated"
  on public.profiles for select
  to authenticated using (true);

-- app_config: 클라 접근 전면 차단 (RPC만 SECURITY DEFINER로 접근)
-- (정책 없음 = 접근 불가)

-- problems: 발행된 것 또는 본인 것만 조회. 작성/수정/삭제는 선생 본인만.
create policy "problems select published or own"
  on public.problems for select
  to authenticated using (is_published or created_by = auth.uid());
create policy "problems insert own teacher"
  on public.problems for insert
  to authenticated with check (created_by = auth.uid() and public.is_teacher());
create policy "problems update own"
  on public.problems for update
  to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "problems delete own"
  on public.problems for delete
  to authenticated using (created_by = auth.uid());

-- submissions: 본인 제출 조회, 또는 본인 문제에 달린 제출 조회(선생). insert는 발행 문제에 본인 것만.
create policy "submissions select own or teacher-of-problem"
  on public.submissions for select
  to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.problems p where p.id = problem_id and p.created_by = auth.uid())
  );
create policy "submissions insert own on published"
  on public.submissions for insert
  to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.problems p where p.id = problem_id and p.is_published)
  );

-- ── Realtime ────────────────────────────────────────────────
alter publication supabase_realtime add table public.problems;
