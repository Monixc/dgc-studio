-- DSL 가져오기 모달에서 제출한 입력값 이력 기록.

create table public.dsl_import_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dsl_text text not null,
  created_at timestamptz not null default now()
);

alter table public.dsl_import_logs enable row level security;

create policy "dsl_import_logs select own"
  on public.dsl_import_logs for select
  to authenticated using (user_id = auth.uid());
create policy "dsl_import_logs insert own"
  on public.dsl_import_logs for insert
  to authenticated with check (user_id = auth.uid());

notify pgrst, 'reload schema';
