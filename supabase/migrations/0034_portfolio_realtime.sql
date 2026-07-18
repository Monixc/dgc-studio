-- 포트폴리오 제출/피드백을 실시간(postgres_changes)으로 전달하기 위해 publication에 추가.
-- 학생 제출 → 교사 화면 즉시 갱신, 교사 피드백 → 학생 화면 즉시 갱신.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'portfolio_submissions'
  ) then
    alter publication supabase_realtime add table public.portfolio_submissions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'portfolio_comments'
  ) then
    alter publication supabase_realtime add table public.portfolio_comments;
  end if;
end $$;
