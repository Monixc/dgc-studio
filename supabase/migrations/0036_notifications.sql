-- 인앱 알림 모아보기(헤더 벨). send-push edge function이 이벤트마다 수신자별 행을 넣는다.
-- 채팅(messages)은 별도 아이콘에서 다루므로 여기엔 message 이벤트를 넣지 않는다.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  url text not null default '/',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- 본인 알림만 조회/읽음처리. insert는 service role(edge function)만 → 스푸핑 방지.
drop policy if exists "notifications owner select" on public.notifications;
create policy "notifications owner select" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifications owner update" on public.notifications;
create policy "notifications owner update" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 실시간 전달: 알림 벨은 notifications, 채팅은 messages 구독
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
