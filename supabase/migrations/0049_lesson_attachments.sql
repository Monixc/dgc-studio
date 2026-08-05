-- 교안 학습 자료 첨부: announcement 패턴 재사용(jsonb 배열 + 전용 버킷).

alter table public.lessons
  add column attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('lesson-assets', 'lesson-assets', true)
on conflict (id) do nothing;

create policy "lesson-assets public read"
  on storage.objects for select
  using (bucket_id = 'lesson-assets');

create policy "lesson-assets teacher insert"
  on storage.objects for insert
  to authenticated with check (bucket_id = 'lesson-assets' and public.is_teacher());

create policy "lesson-assets teacher delete"
  on storage.objects for delete
  to authenticated using (bucket_id = 'lesson-assets' and public.is_teacher());

notify pgrst, 'reload schema';
