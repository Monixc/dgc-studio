-- 학생은 선생님에게만 쪽지를 보낼 수 있도록 제한한다.
drop policy if exists "messages insert own" on public.messages;

create policy "messages insert own with student teacher restriction"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_teacher()
      or exists (
        select 1 from public.profiles recipient
        where recipient.id = recipient_id and recipient.role = 'teacher'
      )
    )
  );
