-- 교사 공유 모델: 모든 교사가 문제를 공유(조회/수정/삭제)하고, 학생 관리에서 전체 학생을 본다.

-- 문제: 모든 교사가 서로의 문제를 조회/수정/삭제 (학생은 발행분만 조회)
drop policy if exists "problems select published or own" on public.problems;
create policy "problems select published or teacher" on public.problems
  for select to authenticated
  using (is_published or is_teacher());

drop policy if exists "problems update own" on public.problems;
create policy "problems update teacher" on public.problems
  for update to authenticated
  using (is_teacher()) with check (is_teacher());

drop policy if exists "problems delete own" on public.problems;
create policy "problems delete teacher" on public.problems
  for delete to authenticated
  using (is_teacher());

-- 학생 관리: 교사가 전체 반/소속을 조회할 수 있어야 전체 학생과 소속 반을 표시 가능
-- (프로필은 이미 authenticated 전체 조회 허용. 등록/삭제 권한은 기존대로 본인 반으로 유지.)
drop policy if exists "classes select teacher" on public.classes;
create policy "classes select teacher" on public.classes
  for select to authenticated
  using (is_teacher());

drop policy if exists "class_students select teacher" on public.class_students;
create policy "class_students select teacher" on public.class_students
  for select to authenticated
  using (is_teacher());
