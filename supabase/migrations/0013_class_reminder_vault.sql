-- 호스팅 Supabase는 postgres 롤이 ALTER DATABASE ... SET app.settings.* 권한이 없어(superuser 아님)
-- 환경별 함수 URL/서비스 롤 키를 Vault 시크릿으로 대체 저장한다. 시크릿 값 자체는 마이그레이션에
-- 넣지 않고 환경별로 1회 vault.create_secret() 실행(로컬/운영 각각)으로 채운다.

create or replace function public.notify_upcoming_classes()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  fn_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_url');
  svc_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
  rec record;
begin
  if fn_url is null or svc_key is null then
    return;
  end if;

  for rec in
    select c.id as class_id, c.name, array_agg(distinct cs.student_id) as student_ids
    from public.classes c
    join public.class_students cs on cs.class_id = c.id
    where c.schedule_time is not null
      and c.schedule_day_of_week = extract(dow from ((now() at time zone 'Asia/Seoul') + interval '30 min'))::smallint
      and date_trunc('minute', c.schedule_time) = date_trunc('minute', ((now() at time zone 'Asia/Seoul') + interval '30 min')::time)
    group by c.id, c.name
  loop
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || svc_key),
      body := jsonb_build_object(
        'event', 'class_reminder',
        'user_ids', to_jsonb(rec.student_ids),
        'title', rec.name || ' 수업 30분 전',
        'body', '곧 수업이 시작됩니다.',
        'url', '/student/myclass'
      )
    );
  end loop;
end;
$$;
