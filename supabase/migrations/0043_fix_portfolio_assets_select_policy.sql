-- 배포된 DB의 "portfolio assets owner or recipient select" 정책이 마이그레이션 파일과
-- 어긋나 있었음: sa.asset_id = s.id (제출 id와 비교) 로 되어 있어 outer 행과 상관되지
-- 않는 조건이 되어 teacher/제출자 조회가 항상 실패했음. 원래 의도대로 재생성.

drop policy if exists "portfolio assets owner or recipient select" on public.portfolio_assets;
create policy "portfolio assets owner or recipient select"
  on public.portfolio_assets for select
  to authenticated using (
    exists (
      select 1
      from public.portfolio_documents d
      where d.id = portfolio_assets.document_id and d.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.portfolio_submission_assets sa
      join public.portfolio_submissions s on s.id = sa.submission_id
      where sa.asset_id = portfolio_assets.id
        and (s.student_id = auth.uid() or public.is_teacher())
    )
  );
