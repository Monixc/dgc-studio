-- 학생 타자 연습 완료 기록. 포인트는 현재 지급하지 않아 0으로 기록한다.

create table public.typing_practice_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (
    mode in ('practice', 'race_live', 'race_ghost', 'ai_learning', 'ai_competition')
  ),
  taja integer not null default 0 check (taja >= 0),
  points integer not null default 0 check (points >= 0),
  completed_at timestamptz not null default now()
);

create index typing_practice_logs_completed_at_idx
  on public.typing_practice_logs (completed_at desc);

create index typing_practice_logs_student_id_idx
  on public.typing_practice_logs (student_id, completed_at desc);

alter table public.typing_practice_logs enable row level security;

create policy "typing_practice_logs select own or teacher"
  on public.typing_practice_logs for select
  to authenticated using (
    student_id = auth.uid() or public.is_teacher()
  );

create policy "typing_practice_logs insert own student"
  on public.typing_practice_logs for insert
  to authenticated with check (
    student_id = auth.uid() and not public.is_teacher()
  );

notify pgrst, 'reload schema';
