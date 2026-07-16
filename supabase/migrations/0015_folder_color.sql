-- 폴더별 색상 지정 (접힌 패널에서 폴더 구분용 아이콘 색으로도 사용).

alter table public.problem_folders add column color text;

notify pgrst, 'reload schema';
