-- 반 학생 등록(명단).
create table public.class_students (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

alter table public.class_students enable row level security;

create policy "class_students select via own class"
  on public.class_students for select
  to authenticated using (
    exists (select 1 from public.classes c where c.id = class_id and c.created_by = auth.uid())
  );
create policy "class_students insert via own class"
  on public.class_students for insert
  to authenticated with check (
    exists (select 1 from public.classes c where c.id = class_id and c.created_by = auth.uid())
  );
create policy "class_students delete via own class"
  on public.class_students for delete
  to authenticated using (
    exists (select 1 from public.classes c where c.id = class_id and c.created_by = auth.uid())
  );
