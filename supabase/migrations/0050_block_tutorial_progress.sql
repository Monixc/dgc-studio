-- 블록 코딩 기본 튜토리얼 진행도. 튜토리얼/미션 정의는 코드(src/features/block-tutorial/tutorials.ts)에 있고,
-- 여기엔 학생별 완료 여부만 기록한다. mission_id 는 코드 쪽 상수 문자열(예: "print-1").

create table public.block_tutorial_progress (
  student_id uuid not null references auth.users(id) on delete cascade,
  mission_id text not null,
  completed_at timestamptz not null default now(),
  primary key (student_id, mission_id)
);

alter table public.block_tutorial_progress enable row level security;

create policy "block_tutorial_progress select own"
  on public.block_tutorial_progress for select
  to authenticated using (student_id = auth.uid());

create policy "block_tutorial_progress insert own"
  on public.block_tutorial_progress for insert
  to authenticated with check (student_id = auth.uid());

notify pgrst, 'reload schema';
