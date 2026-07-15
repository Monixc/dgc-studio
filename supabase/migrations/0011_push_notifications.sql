-- 웹 푸시 구독 저장 + 반 주간 수업 스케줄(요일/시각) 추가.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions select own"
  on public.push_subscriptions for select
  to authenticated using (user_id = auth.uid());
create policy "push_subscriptions insert own"
  on public.push_subscriptions for insert
  to authenticated with check (user_id = auth.uid());
create policy "push_subscriptions delete own"
  on public.push_subscriptions for delete
  to authenticated using (user_id = auth.uid());

-- 0=일요일 ~ 6=토요일. 반 하나당 매주 반복되는 수업 시간 하나만 지원(다중 요일은 미지원, YAGNI).
alter table public.classes add column schedule_day_of_week smallint check (schedule_day_of_week between 0 and 6);
alter table public.classes add column schedule_time time;

notify pgrst, 'reload schema';
