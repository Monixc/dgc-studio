-- 문제/학생이 이미 교사 전원 공유 모델(listMyProblems, listManagedStudents)이라
-- submissions 조회 정책도 "본인이 만든 문제"가 아니라 "인증된 선생님이면 전체 조회 가능"으로 맞춘다.
-- 기존 정책은 공유 문제를 다른 선생님이 반에 할당한 경우 그 반 학생 제출을 못 보는 버그가 있었다.
drop policy "submissions select own or teacher-of-problem" on public.submissions;

create policy "submissions select own or any teacher"
  on public.submissions for select
  to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
  );
