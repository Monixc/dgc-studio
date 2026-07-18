-- 제출받은 교사가 첨부 자산 메타데이터를 조회할 수 있도록
-- 상관 서브쿼리의 바깥쪽 portfolio_assets.id를 명시한다.
drop policy if exists "portfolio assets owner or recipient select"
  on public.portfolio_assets;

create policy "portfolio assets owner or recipient select"
  on public.portfolio_assets for select
  to authenticated using (
    exists (
      select 1
      from public.portfolio_documents d
      where d.id = portfolio_assets.document_id
        and d.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.portfolio_submission_assets sa
      join public.portfolio_submissions s on s.id = sa.submission_id
      where sa.asset_id = portfolio_assets.id
        and (s.student_id = auth.uid() or s.teacher_id = auth.uid())
    )
  );

notify pgrst, 'reload schema';
