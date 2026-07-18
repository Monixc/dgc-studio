-- classes ↔ class_students 정책이 서로를 조회해 발생하는 RLS 무한 재귀를 제거한다.

create or replace function public.is_enrolled_in_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_students cs
    where cs.class_id = p_class_id
      and cs.student_id = auth.uid()
  );
$$;

revoke all on function public.is_enrolled_in_class(uuid) from public;
grant execute on function public.is_enrolled_in_class(uuid) to authenticated;

drop policy if exists "classes select via enrollment" on public.classes;

create policy "classes select via enrollment"
  on public.classes for select
  to authenticated
  using (public.is_enrolled_in_class(id));

notify pgrst, 'reload schema';
