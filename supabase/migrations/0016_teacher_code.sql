-- 선생님 테스트용 코드 분리 (학생 시작 코드 starter_code 와 공유되지 않도록).

alter table public.problems add column teacher_code text not null default '';

notify pgrst, 'reload schema';
