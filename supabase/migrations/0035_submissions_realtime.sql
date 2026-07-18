-- 문제 제출을 실시간(postgres_changes)으로 전달. 학생 제출 → 교사 학생관리/검토 화면 즉시 갱신.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end $$;
