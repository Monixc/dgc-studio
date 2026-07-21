-- 공지사항 이미지/파일 첨부: 별도 테이블 없이 메타데이터를 jsonb 배열로 저장.

alter table public.announcements
  add column attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('announcement-assets', 'announcement-assets', true)
on conflict (id) do nothing;

create policy "announcement-assets public read"
  on storage.objects for select
  using (bucket_id = 'announcement-assets');

create policy "announcement-assets teacher insert"
  on storage.objects for insert
  to authenticated with check (bucket_id = 'announcement-assets' and public.is_teacher());

create policy "announcement-assets teacher delete"
  on storage.objects for delete
  to authenticated using (bucket_id = 'announcement-assets' and public.is_teacher());

notify pgrst, 'reload schema';
