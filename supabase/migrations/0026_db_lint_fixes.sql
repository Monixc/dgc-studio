-- 원격 DB lint 보정: 푸시 알림 HTTP 확장과 숙련도 upsert 충돌 대상을 명확히 한다.

create extension if not exists pg_net with schema extensions;

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

revoke all on function public.typing_ai_lab_apply_hits(jsonb, jsonb) from public;
grant execute on function public.typing_ai_lab_apply_hits(jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
