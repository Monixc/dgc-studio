-- 문제 대분류(카테고리): 순서도 / 파이썬 일반 / 블럭코딩.
-- 기존 문제는 전부 flowchart 로 유지(기본값) — 기존 동작 변경 없음.
alter table public.problems
  add column category text not null default 'flowchart'
  check (category in ('flowchart', 'general', 'block'));
