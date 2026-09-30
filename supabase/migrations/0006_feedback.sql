-- Feedback and bug reports, sent from the in-app "Send feedback" page.
--
-- Write-only from the outside. Anyone may add a row — a guest has no account
-- and is the person most likely to hit a bug on day one — but nobody can read
-- a row back through the API, not even the person who sent it. There is no
-- select, update or delete policy, so RLS refuses all three. You read the
-- reports in the dashboard (Table Editor -> feedback), which bypasses RLS.
--
-- `user_id` is never taken from the client. The column-level grant below
-- leaves it out, so a request that tries to set it is refused outright, and
-- the default fills it from the session: the account's id when logged in,
-- null for a guest. The policy then re-checks that, so a row can never claim
-- to come from somebody else.
--
-- Every text column has a length cap. Without one, the anon key is a free
-- unlimited text store for anyone who reads it out of the bundle.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('bug', 'content', 'idea', 'other')),
  area text check (area is null or char_length(area) <= 40),
  message text not null check (char_length(message) between 5 and 4000),
  contact text check (contact is null or char_length(contact) <= 200),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  user_id uuid default auth.uid() references auth.users (id) on delete set null
);

alter table public.feedback enable row level security;

revoke all on public.feedback from anon, authenticated;
grant insert (kind, area, message, contact, user_agent) on public.feedback to anon, authenticated;

drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback"
  on public.feedback
  for insert
  to anon, authenticated
  with check (user_id is not distinct from auth.uid());

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
