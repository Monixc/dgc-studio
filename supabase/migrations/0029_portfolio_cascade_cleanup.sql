-- 앱에서는 제출본을 수정/삭제할 수 없게 유지하되 계정 삭제 등 관리 작업의 FK 정리는 허용한다.

drop trigger if exists portfolio_submissions_immutable on public.portfolio_submissions;
create trigger portfolio_submissions_immutable
before update on public.portfolio_submissions
for each row execute function public.reject_portfolio_snapshot_mutation();

drop trigger if exists portfolio_submission_assets_immutable on public.portfolio_submission_assets;
create trigger portfolio_submission_assets_immutable
before update on public.portfolio_submission_assets
for each row execute function public.reject_portfolio_snapshot_mutation();

alter table public.portfolio_submissions
  drop constraint portfolio_submissions_document_id_fkey,
  add constraint portfolio_submissions_document_id_fkey
    foreign key (document_id) references public.portfolio_documents(id) on delete cascade,
  drop constraint portfolio_submissions_student_id_fkey,
  add constraint portfolio_submissions_student_id_fkey
    foreign key (student_id) references auth.users(id) on delete cascade;

alter table public.portfolio_submission_assets
  drop constraint portfolio_submission_assets_submission_id_fkey,
  add constraint portfolio_submission_assets_submission_id_fkey
    foreign key (submission_id) references public.portfolio_submissions(id) on delete cascade,
  drop constraint portfolio_submission_assets_asset_id_fkey,
  add constraint portfolio_submission_assets_asset_id_fkey
    foreign key (asset_id) references public.portfolio_assets(id) on delete cascade;

alter table public.portfolio_comments
  drop constraint portfolio_comments_submission_id_fkey,
  add constraint portfolio_comments_submission_id_fkey
    foreign key (submission_id) references public.portfolio_submissions(id) on delete cascade;

notify pgrst, 'reload schema';
