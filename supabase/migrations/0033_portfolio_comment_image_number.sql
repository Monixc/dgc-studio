alter table public.portfolio_comments
  add column asset_index integer,
  drop constraint portfolio_comments_check,
  add constraint portfolio_comments_check check (
    (anchor_type = 'document'
      and asset_id is null and asset_index is null
      and start_position is null and end_position is null
      and start_line is null and end_line is null and quoted_text is null)
    or
    (anchor_type = 'range'
      and asset_id is null and asset_index is null
      and start_position is not null and end_position is not null
      and start_position >= 0 and end_position > start_position
      and ((start_line is null and end_line is null)
        or (start_line is not null and end_line is not null
          and start_line >= 1 and end_line >= start_line)))
    or
    (anchor_type = 'asset'
      and asset_id is not null
      and (asset_index is null or asset_index >= 1)
      and start_position is null and end_position is null
      and start_line is null and end_line is null and quoted_text is null)
  );

notify pgrst, 'reload schema';
