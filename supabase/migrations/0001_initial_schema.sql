-- 0001 — the progress table and its row-level security.
--
-- This is the baseline: everything that existed as the flat `supabase/schema.sql`
-- before migrations. It is written to be safely re-runnable against a project
-- that already has the table, so an existing deployment can adopt the migration
-- history without dropping anything.
--
-- The anon key ships in the browser bundle. That is what it is for, and it is
-- not a secret — but it means row-level security is the *only* thing standing
-- between one student's progress and another's. Every policy below is load
-- bearing. A table with RLS disabled is a table anyone on the internet can read
-- in full with a key they got by viewing source.

create table if not exists public.progress (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text,
  data         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.progress enable row level security;

-- Four policies, one per verb. The DELETE policy is the one an earlier version
-- of this schema was missing: without it "reset my progress" silently failed
-- server side and the next sync pulled everything straight back down, and
-- "delete my account" could not clear the row at all.
drop policy if exists "read own progress"   on public.progress;
drop policy if exists "insert own progress" on public.progress;
drop policy if exists "update own progress" on public.progress;
drop policy if exists "delete own progress" on public.progress;

create policy "read own progress"   on public.progress
  for select using (auth.uid() = user_id);

create policy "insert own progress" on public.progress
  for insert with check (auth.uid() = user_id);

create policy "update own progress" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own progress" on public.progress
  for delete using (auth.uid() = user_id);

-- A guard rail, not a limit anyone will meet.
--
-- The client only ever sends a compacted summary — a few kilobytes — because
-- the raw answer log is kept on the device. This ceiling exists so that a bug
-- or a tampered client cannot quietly push megabytes into a 500 MB database and
-- take the free tier down for everybody. 256 KB is roughly ten times the
-- largest realistic row.
alter table public.progress drop constraint if exists progress_data_size;
alter table public.progress
  add constraint progress_data_size check (pg_column_size(data) < 262144);

create index if not exists progress_updated_at_idx on public.progress (updated_at desc);
