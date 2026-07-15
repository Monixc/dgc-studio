-- 폴더 계층화: 대분류(순서도/파이썬/블럭코딩, category 로 태깅) + 하위 폴더(parent_id).
alter table public.problem_folders
  add column parent_id uuid references public.problem_folders(id) on delete cascade,
  add column category text check (category in ('flowchart', 'general', 'block'));
