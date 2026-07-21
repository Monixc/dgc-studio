-- AI 타이핑 연구소 결과와 개인학습 hit를 세션 단위로 멱등 처리한다.

alter table public.typing_ai_lab_results
  add column session_id uuid not null default gen_random_uuid(),
  add column dataset_ids jsonb not null default '[]'::jsonb,
  add constraint typing_ai_lab_results_user_session_key unique (user_id, session_id);

create policy "typing_ai_lab_results update own"
  on public.typing_ai_lab_results for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table public.typing_ai_lab_hit_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  hits jsonb not null,
  targets jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

alter table public.typing_ai_lab_hit_sessions enable row level security;

create or replace function public.typing_ai_lab_apply_hits(
  p_hits jsonb,
  p_targets jsonb,
  p_session_id uuid
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
  claimed integer;
  stored_hits jsonb;
  stored_targets jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_session_id is null then
    raise exception 'session id is required';
  end if;

  insert into public.typing_ai_lab_hit_sessions (user_id, session_id, hits, targets)
  values (uid, p_session_id, p_hits, p_targets)
  on conflict (user_id, session_id) do nothing;
  get diagnostics claimed = row_count;

  if claimed = 0 then
    select s.hits, s.targets
      into stored_hits, stored_targets
    from public.typing_ai_lab_hit_sessions s
    where s.user_id = uid and s.session_id = p_session_id;

    if stored_hits is distinct from p_hits or stored_targets is distinct from p_targets then
      raise exception 'session payload mismatch';
    end if;

    for rec in select * from jsonb_each_text(p_hits)
    loop
      word_id := rec.key;
      select coalesce(s.correct_count, 0)
        into correct_count
      from public.typing_ai_lab_word_stats s
      where s.user_id = uid and s.word_id = rec.key;
      correct_count := coalesce(correct_count, 0);
      newly_mastered := false;
      return next;
    end loop;
    return;
  end if;

  for rec in select * from jsonb_each_text(p_hits)
  loop
    target := coalesce((p_targets ->> rec.key)::integer, 3);
    was_mastered := exists (
      select 1
      from public.typing_ai_lab_word_stats s
      where s.user_id = uid
        and s.word_id = rec.key
        and s.mastered_at is not null
    );

    insert into public.typing_ai_lab_word_stats as s (
      user_id,
      word_id,
      correct_count,
      mastered_at,
      updated_at
    )
    values (
      uid,
      rec.key,
      greatest(rec.value::integer, 0),
      case when greatest(rec.value::integer, 0) >= target then now() else null end,
      now()
    )
    on conflict on constraint typing_ai_lab_word_stats_pkey do update
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

revoke all on function public.typing_ai_lab_apply_hits(jsonb, jsonb, uuid) from public;
grant execute on function public.typing_ai_lab_apply_hits(jsonb, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
