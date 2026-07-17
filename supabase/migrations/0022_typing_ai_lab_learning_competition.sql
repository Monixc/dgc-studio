-- AI 타이핑 연구소: 숙련도 + 2인 빠른 매칭 경쟁

-- 1) 단어 숙련 통계
create table public.typing_ai_lab_word_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  correct_count integer not null default 0 check (correct_count >= 0),
  mastered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

alter table public.typing_ai_lab_word_stats enable row level security;

create policy "typing_ai_lab_word_stats select own"
  on public.typing_ai_lab_word_stats for select
  to authenticated using (user_id = auth.uid());

create policy "typing_ai_lab_word_stats insert own"
  on public.typing_ai_lab_word_stats for insert
  to authenticated with check (user_id = auth.uid());

create policy "typing_ai_lab_word_stats update own"
  on public.typing_ai_lab_word_stats for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 세션 종료 시 배치 누적. target = difficulty+2 는 클라에서 전달.
create or replace function public.typing_ai_lab_apply_hits(
  p_hits jsonb,
  p_targets jsonb
)
returns table(word_id text, correct_count integer, newly_mastered boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec record;
  new_count integer;
  target integer;
  was_mastered boolean;
  now_mastered boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  for rec in select * from jsonb_each_text(p_hits)
  loop
    target := coalesce((p_targets ->> rec.key)::integer, 3);
    was_mastered := exists (
      select 1 from public.typing_ai_lab_word_stats s
      where s.user_id = uid and s.word_id = rec.key and s.mastered_at is not null
    );

    insert into public.typing_ai_lab_word_stats as s (user_id, word_id, correct_count, mastered_at, updated_at)
    values (
      uid,
      rec.key,
      greatest(rec.value::integer, 0),
      case when greatest(rec.value::integer, 0) >= target then now() else null end,
      now()
    )
    on conflict (user_id, word_id) do update
      set correct_count = s.correct_count + excluded.correct_count,
          mastered_at = case
            when s.mastered_at is not null then s.mastered_at
            when s.correct_count + excluded.correct_count >= target then now()
            else null
          end,
          updated_at = now()
      returning s.correct_count into new_count;

    now_mastered := new_count >= target;
    word_id := rec.key;
    correct_count := new_count;
    newly_mastered := (not was_mastered) and now_mastered;
    return next;
  end loop;
end;
$$;

revoke all on function public.typing_ai_lab_apply_hits(jsonb, jsonb) from public;
grant execute on function public.typing_ai_lab_apply_hits(jsonb, jsonb) to authenticated;

-- 2) 결과 mode 확장 (기존 check 교체)
alter table public.typing_ai_lab_results
  drop constraint if exists typing_ai_lab_results_mode_check;

alter table public.typing_ai_lab_results
  add constraint typing_ai_lab_results_mode_check
  check (mode in ('sprint', 'standard', 'research', 'learning', 'competition'));

-- 3) 빠른 매칭 큐 / 매치 / 참가자
create table public.typing_ai_lab_match_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  pool_ids jsonb not null default '[]'::jsonb,
  pool_size integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.typing_ai_lab_match_queue enable row level security;

create policy "typing_ai_lab_match_queue select authenticated"
  on public.typing_ai_lab_match_queue for select
  to authenticated using (true);

create policy "typing_ai_lab_match_queue insert own"
  on public.typing_ai_lab_match_queue for insert
  to authenticated with check (user_id = auth.uid());

create policy "typing_ai_lab_match_queue delete own"
  on public.typing_ai_lab_match_queue for delete
  to authenticated using (user_id = auth.uid());

create table public.typing_ai_lab_matches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'countdown'
    check (status in ('countdown', 'playing', 'finished', 'abandoned')),
  seed bigint not null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.typing_ai_lab_match_players (
  match_id uuid not null references public.typing_ai_lab_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  pool_ids jsonb not null default '[]'::jsonb,
  total_score numeric(5,1),
  grade text,
  dataset_size integer,
  forfeit boolean not null default false,
  result_id uuid references public.typing_ai_lab_results(id) on delete set null,
  primary key (match_id, user_id)
);

alter table public.typing_ai_lab_matches enable row level security;
alter table public.typing_ai_lab_match_players enable row level security;

create policy "typing_ai_lab_matches select member"
  on public.typing_ai_lab_matches for select
  to authenticated using (
    exists (
      select 1 from public.typing_ai_lab_match_players p
      where p.match_id = id and p.user_id = auth.uid()
    )
  );

create policy "typing_ai_lab_match_players select member"
  on public.typing_ai_lab_match_players for select
  to authenticated using (
    exists (
      select 1 from public.typing_ai_lab_match_players p
      where p.match_id = typing_ai_lab_match_players.match_id and p.user_id = auth.uid()
    )
  );

create policy "typing_ai_lab_match_players update own"
  on public.typing_ai_lab_match_players for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 빠른 매칭: 대기열에 넣거나 상대와 즉시 매치 생성
create or replace function public.typing_ai_lab_quick_match(
  p_display_name text,
  p_pool_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  opponent public.typing_ai_lab_match_queue%rowtype;
  mid uuid;
  new_seed bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_array_length(p_pool_ids) < 25 then
    raise exception 'need at least 25 mastered words';
  end if;

  -- 이미 진행 중 매치가 있으면 반환
  select m.id into mid
  from public.typing_ai_lab_matches m
  join public.typing_ai_lab_match_players p on p.match_id = m.id
  where p.user_id = uid and m.status in ('countdown', 'playing')
  order by m.created_at desc
  limit 1;
  if mid is not null then
    return jsonb_build_object('status', 'matched', 'match_id', mid);
  end if;

  delete from public.typing_ai_lab_match_queue where user_id = uid;

  select * into opponent
  from public.typing_ai_lab_match_queue
  where user_id <> uid
  order by created_at
  for update skip locked
  limit 1;

  if opponent.user_id is null then
    insert into public.typing_ai_lab_match_queue (user_id, display_name, pool_ids, pool_size)
    values (uid, coalesce(p_display_name, ''), p_pool_ids, jsonb_array_length(p_pool_ids))
    on conflict (user_id) do update
      set display_name = excluded.display_name,
          pool_ids = excluded.pool_ids,
          pool_size = excluded.pool_size,
          created_at = now();
    return jsonb_build_object('status', 'queued');
  end if;

  delete from public.typing_ai_lab_match_queue where user_id = opponent.user_id;
  new_seed := (extract(epoch from now()) * 1000)::bigint;
  insert into public.typing_ai_lab_matches (status, seed, started_at)
  values ('countdown', new_seed, now())
  returning id into mid;

  insert into public.typing_ai_lab_match_players (match_id, user_id, display_name, pool_ids)
  values
    (mid, uid, coalesce(p_display_name, ''), p_pool_ids),
    (mid, opponent.user_id, opponent.display_name, opponent.pool_ids);

  return jsonb_build_object('status', 'matched', 'match_id', mid, 'seed', new_seed);
end;
$$;

create or replace function public.typing_ai_lab_cancel_queue()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.typing_ai_lab_match_queue where user_id = auth.uid();
end;
$$;

create or replace function public.typing_ai_lab_start_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.typing_ai_lab_matches
  set status = 'playing', started_at = coalesce(started_at, now())
  where id = p_match_id
    and status = 'countdown'
    and exists (
      select 1 from public.typing_ai_lab_match_players p
      where p.match_id = p_match_id and p.user_id = auth.uid()
    );
end;
$$;

create or replace function public.typing_ai_lab_finish_match(
  p_match_id uuid,
  p_total_score numeric,
  p_grade text,
  p_dataset_size integer,
  p_result_id uuid default null,
  p_forfeit boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  remaining integer;
begin
  update public.typing_ai_lab_match_players
  set total_score = p_total_score,
      grade = p_grade,
      dataset_size = p_dataset_size,
      result_id = p_result_id,
      forfeit = p_forfeit
  where match_id = p_match_id and user_id = uid;

  select count(*) into remaining
  from public.typing_ai_lab_match_players
  where match_id = p_match_id and total_score is null and forfeit = false;

  if remaining = 0 then
    update public.typing_ai_lab_matches
    set status = 'finished', finished_at = now()
    where id = p_match_id;
  end if;
end;
$$;

create or replace function public.typing_ai_lab_forfeit_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.typing_ai_lab_finish_match(p_match_id, 0, 'D', 0, null, true);
  update public.typing_ai_lab_matches
  set status = 'abandoned', finished_at = now()
  where id = p_match_id and status in ('countdown', 'playing');
end;
$$;

revoke all on function public.typing_ai_lab_quick_match(text, jsonb) from public;
revoke all on function public.typing_ai_lab_cancel_queue() from public;
revoke all on function public.typing_ai_lab_start_match(uuid) from public;
revoke all on function public.typing_ai_lab_finish_match(uuid, numeric, text, integer, uuid, boolean) from public;
revoke all on function public.typing_ai_lab_forfeit_match(uuid) from public;

grant execute on function public.typing_ai_lab_quick_match(text, jsonb) to authenticated;
grant execute on function public.typing_ai_lab_cancel_queue() to authenticated;
grant execute on function public.typing_ai_lab_start_match(uuid) to authenticated;
grant execute on function public.typing_ai_lab_finish_match(uuid, numeric, text, integer, uuid, boolean) to authenticated;
grant execute on function public.typing_ai_lab_forfeit_match(uuid) to authenticated;

alter publication supabase_realtime add table public.typing_ai_lab_matches;
alter publication supabase_realtime add table public.typing_ai_lab_match_players;

notify pgrst, 'reload schema';
