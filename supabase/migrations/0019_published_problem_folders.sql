-- 학생이 발행된 문제의 하위 폴더 이름을 문제 목록에서 볼 수 있게 한다.
create policy "problem_folders select published problem folders"
  on public.problem_folders for select
  to authenticated
  using (
    exists (
      select 1
      from public.problems
      where problems.folder_id = problem_folders.id
        and problems.is_published = true
    )
  );
