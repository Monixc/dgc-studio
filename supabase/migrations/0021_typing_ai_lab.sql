-- AI 타이핑 연구소: 세션 결과 + 전역 랭킹

create table public.typing_ai_lab_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'standard' check (mode in ('sprint', 'standard', 'research')),
  elapsed_ms integer not null check (elapsed_ms >= 0),
  accuracy numeric(5,1) not null check (accuracy >= 0 and accuracy <= 100),
  dataset_score numeric(5,1) not null check (dataset_score >= 0 and dataset_score <= 100),
  density_score numeric(5,1) not null check (density_score >= 0 and density_score <= 100),
  coverage_score numeric(5,1) not null check (coverage_score >= 0 and coverage_score <= 100),
  inference_score numeric(5,1) not null check (inference_score >= 0 and inference_score <= 100),
  total_score numeric(5,1) not null check (total_score >= 0 and total_score <= 100),
  grade text not null check (grade in ('SSS', 'SS', 'S', 'A', 'B', 'C', 'D')),
  dataset_size integer not null default 0 check (dataset_size >= 0),
  dataset jsonb not null default '[]'::jsonb,
  sentences jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index typing_ai_lab_results_total_score_idx
  on public.typing_ai_lab_results (total_score desc, created_at desc);

create index typing_ai_lab_results_user_id_idx
  on public.typing_ai_lab_results (user_id, created_at desc);

alter table public.typing_ai_lab_results enable row level security;

create policy "typing_ai_lab_results select authenticated"
  on public.typing_ai_lab_results for select
  to authenticated using (true);

create policy "typing_ai_lab_results insert own"
  on public.typing_ai_lab_results for insert
  to authenticated with check (user_id = auth.uid());

notify pgrst, 'reload schema';
