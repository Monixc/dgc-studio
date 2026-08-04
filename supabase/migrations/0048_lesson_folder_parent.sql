-- 교안 폴더도 문제 폴더처럼 하위 폴더 계층 지원(0006_folder_hierarchy.sql 참고).

alter table public.lesson_folders
  add column parent_id uuid references public.lesson_folders(id) on delete cascade;

notify pgrst, 'reload schema';
