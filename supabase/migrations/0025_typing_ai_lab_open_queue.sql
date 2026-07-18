-- 숙련 단어 수와 무관하게 경쟁 대기열에 입장할 수 있게 한다.

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

notify pgrst, 'reload schema';
