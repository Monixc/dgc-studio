-- 반(class) / 문제 폴더 / 반-문제 배정
-- 0001과 동일 패턴: is_teacher() 재사용, created_by 소유 기반 RLS.

-- ── problem_folders ────────────────────────────────────────────
create table public.problem_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.problems
  add column folder_id uuid references public.problem_folders(id) on delete set null;

-- ── classes ─────────────────────────────────────────────────────
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── class_problems (다대다: 같은 문제를 여러 반에 재사용 배정) ──
create table public.class_problems (
  class_id uuid not null references public.classes(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, problem_id)
);

-- ── RLS ─────────────────────────────────────────────────────────
alter table public.problem_folders enable row level security;
alter table public.classes enable row level security;
alter table public.class_problems enable row level security;

create policy "problem_folders select own"
  on public.problem_folders for select
  to authenticated using (created_by = auth.uid());
create policy "problem_folders insert own teacher"
  on public.problem_folders for insert
  to authenticated with check (created_by = auth.uid() and public.is_teacher());
create policy "problem_folders update own"
  on public.problem_folders for update
  to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "problem_folders delete own"
  on public.problem_folders for delete
  to authenticated using (created_by = auth.uid());

create policy "classes select own"
  on public.classes for select
  to authenticated using (created_by = auth.uid());
create policy "classes insert own teacher"
  on public.classes for insert
  to authenticated with check (created_by = auth.uid() and public.is_teacher());
create policy "classes update own"
  on public.classes for update
  to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "classes delete own"
  on public.classes for delete
  to authenticated using (created_by = auth.uid());

create policy "class_problems select via own class"
  on public.class_problems for select
  to authenticated using (
    exists (select 1 from public.classes c where c.id = class_id and c.created_by = auth.uid())
  );
create policy "class_problems insert via own class"
  on public.class_problems for insert
  to authenticated with check (
    exists (select 1 from public.classes c where c.id = class_id and c.created_by = auth.uid())
  );
create policy "class_problems delete via own class"
  on public.class_problems for delete
  to authenticated using (
    exists (select 1 from public.classes c where c.id = class_id and c.created_by = auth.uid())
  );
