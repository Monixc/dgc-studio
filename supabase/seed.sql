-- 선생 가입 코드 시드. 배포 전 값을 바꾸세요.
insert into public.app_config (key, value)
values ('teacher_code', 'change-me-teacher-code')
on conflict (key) do update set value = excluded.value;
