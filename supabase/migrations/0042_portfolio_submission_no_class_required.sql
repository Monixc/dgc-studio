-- 포트폴리오 제출: 반 소속 여부와 무관하게 제출 가능해야 함(교사 공유 모델과 동일 취지).
-- class_id/teacher_id는 이제 select 정책에 쓰이지 않는 참고 정보이므로 nullable로 완화.

alter table public.portfolio_submissions
  alter column class_id drop not null;
alter table public.portfolio_submissions
  alter column teacher_id drop not null;

drop function if exists public.submit_portfolio_document(uuid, bigint);

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

  -- 반 소속이면 참고용으로 채워두고, 아니면 null로 둔 채 제출을 막지 않는다.
  select c.id, c.created_by
  into v_class_id, v_teacher_id
  from public.classes c
  join public.class_students cs
    on cs.class_id = c.id and cs.student_id = v_uid
  join public.profiles teacher
    on teacher.id = c.created_by and teacher.role = 'teacher'
  order by c.created_at
  limit 1;

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
