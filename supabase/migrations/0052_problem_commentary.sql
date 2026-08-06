-- 선생님 전용 해설(수업 중 라이브 뷰에서만 표시, 학생 화면엔 렌더링하지 않음). Markdown.
alter table public.problems add column commentary text not null default '';
