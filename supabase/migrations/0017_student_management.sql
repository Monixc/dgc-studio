-- 학생 관리용 교사 메모와 제출 피드백

create table public.student_management_notes (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date,
  notes text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.submission_comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index submission_comments_submission_id_idx on public.submission_comments(submission_id, created_at);

alter table public.student_management_notes enable row level security;
alter table public.submission_comments enable row level security;

create policy "student notes teacher only"
  on public.student_management_notes for all
  to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy "submission comments readable by submission participants"
  on public.submission_comments for select
  to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.submissions s
      join public.problems p on p.id = s.problem_id
      where s.id = submission_id and (s.user_id = auth.uid() or p.created_by = auth.uid())
    )
  );

create policy "submission comments teacher insert"
  on public.submission_comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.submissions s
      join public.problems p on p.id = s.problem_id
      where s.id = submission_id and p.created_by = auth.uid()
    )
  );

create policy "submission comments author update"
  on public.submission_comments for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "submission comments author delete"
  on public.submission_comments for delete
  to authenticated
  using (author_id = auth.uid());
