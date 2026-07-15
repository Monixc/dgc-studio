-- 수업 시작 30분 전 학생 웹 푸시 알림. pg_cron이 1분마다 확인해 send-push 함수를 직접 호출한다.
-- 함수 URL/서비스 롤 키는 환경마다 달라 마이그레이션에 하드코딩하지 않고 DB 설정(app.settings.*)으로
-- 환경별로 별도 지정한다(로컬/운영 각각 1회, ALTER DATABASE ... SET 으로 수동 설정).

create extension if not exists pg_cron;

create or replace function public.notify_upcoming_classes()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  fn_url text := current_setting('app.settings.functions_url', true);
  svc_key text := current_setting('app.settings.service_role_key', true);
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

select cron.schedule('notify-upcoming-classes', '* * * * *', $$select public.notify_upcoming_classes();$$);
