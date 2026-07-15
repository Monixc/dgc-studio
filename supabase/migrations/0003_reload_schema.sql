-- PostgREST 스키마 캐시 강제 리로드 (0002 적용 후 classes/class_problems/problem_folders 가
-- 캐시에 안 잡히는 문제 대응).
notify pgrst, 'reload schema';
