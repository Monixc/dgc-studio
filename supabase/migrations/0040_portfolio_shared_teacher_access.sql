-- 포트폴리오도 0038과 같은 교사 공유 모델 적용: 제출 시 선생님 선택 없이 제출하고,
-- 모든 교사가 학생 관리에서 제출/피드백을 열람·작성할 수 있게 한다.

drop function if exists public.submit_portfolio_document(uuid, uuid, bigint);

create function public.submit_portfolio_document(
  p_document_id uuid,
  p_expected_revision bigint
)
returns public.portfolio_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_document public.portfolio_documents%rowtype;
  v_class_id uuid;
  v_teacher_id uuid;
  v_version bigint;
  v_submission public.portfolio_submissions%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = v_uid and p.role = 'student'
  ) then
    raise exception 'only students can submit portfolio documents';
  end if;

  select d.*
  into v_document
  from public.portfolio_documents d
  where d.id = p_document_id
  for update;

  if not found or v_document.student_id <> v_uid then
    raise exception 'portfolio document not found';
  end if;

  if p_expected_revision is null or v_document.revision <> p_expected_revision then
    raise exception 'portfolio document revision conflict';
  end if;

  select c.id, c.created_by
  into v_class_id, v_teacher_id
  from public.classes c
  join public.class_students cs
    on cs.class_id = c.id and cs.student_id = v_uid
  join public.profiles teacher
    on teacher.id = c.created_by and teacher.role = 'teacher'
  order by c.created_at
  limit 1;

  if v_class_id is null then
    raise exception 'student is not enrolled in any class';
  end if;

  select coalesce(max(s.version), 0) + 1
  into v_version
  from public.portfolio_submissions s
  where s.document_id = v_document.id;

  insert into public.portfolio_submissions (
    document_id,
    student_id,
    class_id,
    teacher_id,
    version,
    source_revision,
    title,
    content_json,
    content_text
  )
  values (
    v_document.id,
    v_uid,
    v_class_id,
    v_teacher_id,
    v_version,
    v_document.revision,
    v_document.title,
    v_document.content_json,
    v_document.content_text
  )
  returning * into v_submission;

  insert into public.portfolio_submission_assets (submission_id, asset_id)
  select v_submission.id, a.id
  from public.portfolio_assets a
  where a.document_id = v_document.id;

  return v_submission;
end;
$$;

revoke all on function public.submit_portfolio_document(uuid, bigint) from public;
grant execute on function public.submit_portfolio_document(uuid, bigint) to authenticated;

drop policy if exists "portfolio submissions student or exact teacher select" on public.portfolio_submissions;
create policy "portfolio submissions student or any teacher select"
  on public.portfolio_submissions for select
  to authenticated using (student_id = auth.uid() or public.is_teacher());

drop policy if exists "portfolio submission assets participant select" on public.portfolio_submission_assets;
create policy "portfolio submission assets participant select"
  on public.portfolio_submission_assets for select
  to authenticated using (
    exists (
      select 1
      from public.portfolio_submissions s
      where s.id = submission_id
        and (s.student_id = auth.uid() or public.is_teacher())
    )
  );

drop policy if exists "portfolio assets owner or recipient select" on public.portfolio_assets;
create policy "portfolio assets owner or recipient select"
  on public.portfolio_assets for select
  to authenticated using (
    exists (
      select 1
      from public.portfolio_documents d
      where d.id = document_id and d.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.portfolio_submission_assets sa
      join public.portfolio_submissions s on s.id = sa.submission_id
      where sa.asset_id = id
        and (s.student_id = auth.uid() or public.is_teacher())
    )
  );

drop policy if exists "portfolio comments participant select" on public.portfolio_comments;
create policy "portfolio comments participant select"
  on public.portfolio_comments for select
  to authenticated using (
    exists (
      select 1
      from public.portfolio_submissions s
      where s.id = submission_id
        and (s.student_id = auth.uid() or public.is_teacher())
    )
  );

drop policy if exists "portfolio comments exact teacher insert" on public.portfolio_comments;
create policy "portfolio comments any teacher insert"
  on public.portfolio_comments for insert
  to authenticated with check (
    author_id = auth.uid()
    and public.is_teacher()
    and exists (select 1 from public.portfolio_submissions s where s.id = submission_id)
  );

drop policy if exists "portfolio comments exact teacher update" on public.portfolio_comments;
create policy "portfolio comments any teacher update"
  on public.portfolio_comments for update
  to authenticated using (author_id = auth.uid() and public.is_teacher())
  with check (author_id = auth.uid() and public.is_teacher());

drop policy if exists "portfolio comments exact teacher delete" on public.portfolio_comments;
create policy "portfolio comments any teacher delete"
  on public.portfolio_comments for delete
  to authenticated using (author_id = auth.uid() and public.is_teacher());

drop policy if exists "portfolio storage owner or recipient select" on storage.objects;
create policy "portfolio storage owner or recipient select"
  on storage.objects for select
  to authenticated using (
    bucket_id = 'portfolio-assets'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or exists (
        select 1
        from public.portfolio_assets a
        join public.portfolio_submission_assets sa on sa.asset_id = a.id
        join public.portfolio_submissions s on s.id = sa.submission_id
        where a.storage_path = name and public.is_teacher()
      )
    )
  );

notify pgrst, 'reload schema';
