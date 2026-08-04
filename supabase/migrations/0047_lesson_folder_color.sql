-- 교안 폴더도 문제 폴더처럼 색상 지정 가능하게 (0015_folder_color.sql 참고).

alter table public.lesson_folders add column color text;

notify pgrst, 'reload schema';
