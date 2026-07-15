-- 포인트 상점 상품 이미지: 외부 URL 대신 Storage 버킷으로 관리

insert into storage.buckets (id, name, public)
values ('shop-items', 'shop-items', true)
on conflict (id) do nothing;

create policy "shop-items public read"
  on storage.objects for select
  using (bucket_id = 'shop-items');

create policy "shop-items teacher insert"
  on storage.objects for insert
  to authenticated with check (bucket_id = 'shop-items' and public.is_teacher());

create policy "shop-items teacher update"
  on storage.objects for update
  to authenticated using (bucket_id = 'shop-items' and public.is_teacher())
  with check (bucket_id = 'shop-items' and public.is_teacher());

create policy "shop-items teacher delete"
  on storage.objects for delete
  to authenticated using (bucket_id = 'shop-items' and public.is_teacher());

notify pgrst, 'reload schema';
