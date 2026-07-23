-- 교안 폴더: problem_folders 패턴(소유 교사 RLS). 단층 폴더(계층 없음).

create table public.lesson_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.lessons
  add column folder_id uuid references public.lesson_folders(id) on delete set null;

alter table public.lesson_folders enable row level security;

create policy "lesson_folders select own"
  on public.lesson_folders for select
  to authenticated using (created_by = auth.uid());
create policy "lesson_folders insert own teacher"
  on public.lesson_folders for insert
  to authenticated with check (created_by = auth.uid() and public.is_teacher());
create policy "lesson_folders update own"
  on public.lesson_folders for update
  to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "lesson_folders delete own"
  on public.lesson_folders for delete
  to authenticated using (created_by = auth.uid());

notify pgrst, 'reload schema';
