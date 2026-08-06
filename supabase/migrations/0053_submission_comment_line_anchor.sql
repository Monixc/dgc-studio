-- 코드 특정 줄에 코멘트 앵커(드래그 선택 범위). 둘 다 null 이면 일반 코멘트.
alter table public.submission_comments
  add column start_line integer,
  add column end_line integer,
  add column quoted_text text,
  add constraint submission_comments_line_anchor_check check (
    (start_line is null and end_line is null)
    or (start_line is not null and end_line is not null and start_line >= 1 and end_line >= start_line)
  );
