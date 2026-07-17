-- 학생이 본인이 속한 반의 created_by(담당 선생님)를 조회할 수 있게 한다.
create policy "classes select via enrollment"
  on public.classes for select
  to authenticated
  using (
    exists (
      select 1 from public.class_students cs
      where cs.class_id = classes.id and cs.student_id = auth.uid()
    )
  );
