-- 문제 제출 첨삭(교사→학생)을 학생 화면에 실시간 반영.
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='submission_comments') then
    alter publication supabase_realtime add table public.submission_comments;
  end if;
end $$;
