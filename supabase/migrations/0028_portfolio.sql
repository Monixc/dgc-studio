-- 학생 포트폴리오 초안, 제출 스냅샷, 자산, 피드백.

create table public.portfolio_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content_json jsonb not null default '{}'::jsonb,
  content_text text not null default '',
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolio_assets (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.portfolio_documents(id) on delete cascade,
  storage_path text not null unique check (storage_path <> ''),
  file_name text not null check (file_name <> ''),
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create table public.portfolio_submissions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.portfolio_documents(id),
  student_id uuid not null references auth.users(id),
  class_id uuid not null references public.classes(id),
  teacher_id uuid not null references auth.users(id),
  version bigint not null check (version >= 1),
  source_revision bigint not null check (source_revision >= 1),
  title text not null,
  content_json jsonb not null,
  content_text text not null,
  submitted_at timestamptz not null default now(),
  unique (document_id, version)
);

create table public.portfolio_submission_assets (
  submission_id uuid not null references public.portfolio_submissions(id),
  asset_id uuid not null references public.portfolio_assets(id),
  primary key (submission_id, asset_id)
);

create table public.portfolio_comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.portfolio_submissions(id),
  author_id uuid not null references auth.users(id),
  body text not null check (btrim(body) <> ''),
  anchor_type text not null default 'document' check (anchor_type in ('document', 'range')),
  start_position integer,
  end_position integer,
  start_line integer,
  end_line integer,
  quoted_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (anchor_type = 'document'
      and start_position is null and end_position is null
      and start_line is null and end_line is null and quoted_text is null)
    or
    (anchor_type = 'range'
      and start_position is not null and end_position is not null
      and start_position >= 0 and end_position > start_position
      and ((start_line is null and end_line is null)
        or (start_line is not null and end_line is not null
          and start_line >= 1 and end_line >= start_line)))
  )
);

create index portfolio_documents_student_updated_idx
  on public.portfolio_documents (student_id, updated_at desc);
create index portfolio_assets_document_idx
  on public.portfolio_assets (document_id);
create index portfolio_submissions_student_submitted_idx
  on public.portfolio_submissions (student_id, submitted_at desc);
create index portfolio_submissions_teacher_submitted_idx
  on public.portfolio_submissions (teacher_id, submitted_at desc);
create index portfolio_submissions_class_submitted_idx
  on public.portfolio_submissions (class_id, submitted_at desc);
create index portfolio_submission_assets_asset_idx
  on public.portfolio_submission_assets (asset_id);
create index portfolio_comments_submission_created_idx
  on public.portfolio_comments (submission_id, created_at);

create function public.set_portfolio_document_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.revision <> old.revision + 1 then
    raise exception 'portfolio document revision must increase by one';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger portfolio_documents_set_updated_at
before update on public.portfolio_documents
for each row execute function public.set_portfolio_document_updated_at();

create function public.set_portfolio_comment_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger portfolio_comments_set_updated_at
before update on public.portfolio_comments
for each row execute function public.set_portfolio_comment_updated_at();

create function public.reject_portfolio_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'portfolio submission snapshots are immutable';
end;
$$;

create trigger portfolio_submissions_immutable
before update or delete on public.portfolio_submissions
for each row execute function public.reject_portfolio_snapshot_mutation();

create trigger portfolio_submission_assets_immutable
before update or delete on public.portfolio_submission_assets
for each row execute function public.reject_portfolio_snapshot_mutation();

create function public.is_teacher_of_student(p_student_id uuid, p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    join public.class_students cs on cs.class_id = c.id
    join public.profiles p on p.id = c.created_by
    where c.id = p_class_id
      and c.created_by = auth.uid()
      and cs.student_id = p_student_id
      and p.role = 'teacher'
  );
$$;

create function public.submit_portfolio_document(
  p_document_id uuid,
  p_class_id uuid,
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

  select c.created_by
  into v_teacher_id
  from public.classes c
  join public.class_students cs
    on cs.class_id = c.id and cs.student_id = v_uid
  join public.profiles teacher
    on teacher.id = c.created_by and teacher.role = 'teacher'
  where c.id = p_class_id;

  if v_teacher_id is null then
    raise exception 'student is not enrolled in this class';
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
    p_class_id,
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

revoke all on function public.set_portfolio_document_updated_at() from public;
revoke all on function public.set_portfolio_comment_updated_at() from public;
revoke all on function public.reject_portfolio_snapshot_mutation() from public;
revoke all on function public.is_teacher_of_student(uuid, uuid) from public;
revoke all on function public.submit_portfolio_document(uuid, uuid, bigint) from public;
grant execute on function public.is_teacher_of_student(uuid, uuid) to authenticated;
grant execute on function public.submit_portfolio_document(uuid, uuid, bigint) to authenticated;

alter table public.portfolio_documents enable row level security;
alter table public.portfolio_assets enable row level security;
alter table public.portfolio_submissions enable row level security;
alter table public.portfolio_submission_assets enable row level security;
alter table public.portfolio_comments enable row level security;

create policy "portfolio documents owner select"
  on public.portfolio_documents for select
  to authenticated using (student_id = auth.uid());
create policy "portfolio documents student insert"
  on public.portfolio_documents for insert
  to authenticated with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'student'
    )
  );
create policy "portfolio documents owner update"
  on public.portfolio_documents for update
  to authenticated using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'student'
    )
  );
create policy "portfolio documents owner delete"
  on public.portfolio_documents for delete
  to authenticated using (student_id = auth.uid());

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
        and (s.student_id = auth.uid() or s.teacher_id = auth.uid())
    )
  );
create policy "portfolio assets owner insert"
  on public.portfolio_assets for insert
  to authenticated with check (
    split_part(storage_path, '/', 1) = auth.uid()::text
    and split_part(storage_path, '/', 2) = document_id::text
    and exists (
      select 1
      from public.portfolio_documents d
      where d.id = document_id and d.student_id = auth.uid()
    )
  );
create policy "portfolio assets owner delete unsubmitted"
  on public.portfolio_assets for delete
  to authenticated using (
    exists (
      select 1
      from public.portfolio_documents d
      where d.id = document_id and d.student_id = auth.uid()
    )
    and not exists (
      select 1 from public.portfolio_submission_assets sa where sa.asset_id = id
    )
  );

create policy "portfolio submissions student or exact teacher select"
  on public.portfolio_submissions for select
  to authenticated using (student_id = auth.uid() or teacher_id = auth.uid());

create policy "portfolio submission assets participant select"
  on public.portfolio_submission_assets for select
  to authenticated using (
    exists (
      select 1
      from public.portfolio_submissions s
      where s.id = submission_id
        and (s.student_id = auth.uid() or s.teacher_id = auth.uid())
    )
  );

create policy "portfolio comments participant select"
  on public.portfolio_comments for select
  to authenticated using (
    exists (
      select 1
      from public.portfolio_submissions s
      where s.id = submission_id
        and (s.student_id = auth.uid() or s.teacher_id = auth.uid())
    )
  );
create policy "portfolio comments exact teacher insert"
  on public.portfolio_comments for insert
  to authenticated with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.portfolio_submissions s
      where s.id = submission_id and s.teacher_id = auth.uid()
    )
  );
create policy "portfolio comments exact teacher update"
  on public.portfolio_comments for update
  to authenticated using (
    author_id = auth.uid()
    and exists (
      select 1
      from public.portfolio_submissions s
      where s.id = submission_id and s.teacher_id = auth.uid()
    )
  )
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.portfolio_submissions s
      where s.id = submission_id and s.teacher_id = auth.uid()
    )
  );
create policy "portfolio comments exact teacher delete"
  on public.portfolio_comments for delete
  to authenticated using (
    author_id = auth.uid()
    and exists (
      select 1
      from public.portfolio_submissions s
      where s.id = submission_id and s.teacher_id = auth.uid()
    )
  );

revoke all on table public.portfolio_documents from public, anon, authenticated;
revoke all on table public.portfolio_assets from public, anon, authenticated;
revoke all on table public.portfolio_submissions from public, anon, authenticated;
revoke all on table public.portfolio_submission_assets from public, anon, authenticated;
revoke all on table public.portfolio_comments from public, anon, authenticated;
grant select, insert, update, delete on table public.portfolio_documents to authenticated;
grant select, insert, delete on table public.portfolio_assets to authenticated;
grant select on table public.portfolio_submissions to authenticated;
grant select on table public.portfolio_submission_assets to authenticated;
grant select, insert, update, delete on table public.portfolio_comments to authenticated;

insert into storage.buckets (id, name, public)
values ('portfolio-assets', 'portfolio-assets', false)
on conflict (id) do update set public = false;

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
        where a.storage_path = name and s.teacher_id = auth.uid()
      )
    )
  );
create policy "portfolio storage owner insert"
  on storage.objects for insert
  to authenticated with check (
    bucket_id = 'portfolio-assets'
    and split_part(name, '/', 1) = auth.uid()::text
  );
create policy "portfolio storage owner delete unsubmitted"
  on storage.objects for delete
  to authenticated using (
    bucket_id = 'portfolio-assets'
    and split_part(name, '/', 1) = auth.uid()::text
    and not exists (
      select 1
      from public.portfolio_assets a
      join public.portfolio_submission_assets sa on sa.asset_id = a.id
      where a.storage_path = name
    )
  );

notify pgrst, 'reload schema';
