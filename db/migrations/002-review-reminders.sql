-- Adds review reminder emails to a database created from an older db/schema.sql.
-- Safe to run more than once. Visits that exist when the column is first added count as
-- already reminded, so turning this on never emails about old visits.
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = current_schema() and table_name = 'visits' and column_name = 'review_reminder_sent_at'
  ) then
    alter table visits add column review_reminder_sent_at timestamptz;
    update visits set review_reminder_sent_at = created_at;
  end if;
end
$$;

create index if not exists visits_review_reminder_idx on visits (created_at) where review_reminder_sent_at is null;

commit;
