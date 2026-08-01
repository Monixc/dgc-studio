-- 교안=수업 단위: 교안에 문제를 순서대로 첨부. 배정은 교안 단위(class_lessons)만.

create table public.lesson_problems (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (lesson_id, problem_id)
);

alter table public.lesson_problems enable row level security;

-- 조회: 교안이 나에게 보이면(소유 교사이거나 배정된 반 학생) 첨부 문제도 조회 가능
create policy "lesson_problems select via lesson visibility"
  on public.lesson_problems for select
  to authenticated using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id
        and (
          l.created_by = auth.uid()
          or exists (
            select 1 from public.class_lessons cl
            join public.class_students cs on cs.class_id = cl.class_id
            where cl.lesson_id = l.id and cs.student_id = auth.uid()
          )
        )
    )
  );

-- 편집: 교안 소유 교사만
create policy "lesson_problems insert via own lesson"
  on public.lesson_problems for insert
  to authenticated with check (
    public.is_teacher()
    and exists (select 1 from public.lessons l where l.id = lesson_id and l.created_by = auth.uid())
  );
create policy "lesson_problems delete via own lesson"
  on public.lesson_problems for delete
  to authenticated using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.created_by = auth.uid())
  );

notify pgrst, 'reload schema';
