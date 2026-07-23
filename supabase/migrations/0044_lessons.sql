-- 교안(lesson): 교사가 HTML 업로드 또는 Markdown 작성.
-- code_practice 체크 시 학생 화면에서 코드 IDE를 함께 띄움. 미체크면 내용만 열람.
-- 0002/0007 패턴 그대로: is_teacher() + created_by 소유 RLS, 배정은 class_lessons 다대다.

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content_type text not null default 'md' check (content_type in ('md', 'html')),
  content text not null default '',
  code_practice boolean not null default false,
  starter_code text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_lessons (
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, lesson_id)
);

alter table public.lessons enable row level security;
alter table public.class_lessons enable row level security;

-- lessons: 소유 교사 전체 + 배정된 반 소속 학생 열람
create policy "lessons select own or assigned"
  on public.lessons for select
  to authenticated using (
    created_by = auth.uid()
    or exists (
      select 1 from public.class_lessons cl
      join public.class_students cs on cs.class_id = cl.class_id
      where cl.lesson_id = lessons.id and cs.student_id = auth.uid()
    )
  );
create policy "lessons insert own teacher"
  on public.lessons for insert
  to authenticated with check (created_by = auth.uid() and public.is_teacher());
create policy "lessons update own"
  on public.lessons for update
  to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "lessons delete own"
  on public.lessons for delete
  to authenticated using (created_by = auth.uid());

-- class_lessons: 교사(자기 반) + 학생(등록된 반) 조회, 교사만 배정/해제
create policy "class_lessons select via own class"
  on public.class_lessons for select
  to authenticated using (
    exists (select 1 from public.classes c where c.id = class_id and c.created_by = auth.uid())
  );
create policy "class_lessons select via enrollment"
  on public.class_lessons for select
  to authenticated using (
    exists (select 1 from public.class_students cs where cs.class_id = class_lessons.class_id and cs.student_id = auth.uid())
  );
create policy "class_lessons insert via own class"
  on public.class_lessons for insert
  to authenticated with check (
    exists (select 1 from public.classes c where c.id = class_id and c.created_by = auth.uid())
  );
create policy "class_lessons delete via own class"
  on public.class_lessons for delete
  to authenticated using (
    exists (select 1 from public.classes c where c.id = class_id and c.created_by = auth.uid())
  );

notify pgrst, 'reload schema';
