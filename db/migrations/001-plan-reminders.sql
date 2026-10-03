-- Adds planned-visit reminders to a database created from an older db/schema.sql.
-- Safe to run more than once.
begin;

alter table places add column if not exists planned_time time;
alter table places add column if not exists plan_note text not null default '' check (char_length(plan_note) <= 200);
alter table places add column if not exists plan_reminder text not null default 'none'
  check (plan_reminder in ('none', 'morning', 'day-before', 'week-before'));
alter table places add column if not exists remind_at timestamptz;
alter table places add column if not exists reminder_sent_at timestamptz;
create index if not exists places_due_reminder_idx on places (remind_at) where reminder_sent_at is null;

alter table member_settings add column if not exists plan_reminders boolean not null default true;

commit;
