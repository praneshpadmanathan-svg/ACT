-- 0003 — entitlements, redemption codes, and the trial that starts itself.
--
-- What a person is entitled to is the one piece of state in this app that they
-- must not be able to write. Progress is theirs and RLS only stops them
-- touching *someone else's*; an entitlement is different, because the row they
-- would most like to edit is their own.
--
-- So the shape here is deliberate and worth stating plainly: RLS is on, there
-- is exactly one policy, and it is a SELECT. With RLS enabled and no policy
-- for a verb, that verb is denied to every client holding the anon key — which
-- is to say, to every browser. The only writer is the `service_role` key, and
-- that key exists solely inside Edge Function environments and never in a
-- bundle. Same reasoning as supabase/functions/delete-account/index.ts.
--
-- Written to be safely re-runnable against a project that already has some of
-- this, matching the convention set by 0001.

-- ---------------------------------------------------------------- entitlements

create table if not exists public.entitlements (
  user_id                  uuid primary key references auth.users on delete cascade,
  plan                     text not null default 'free',
  status                   text not null default 'trialing',
  -- When the free trial stops. Null once they are a paying subscriber.
  trial_ends_at            timestamptz,
  -- Paid through this instant. Null on an active `source='code'` grant, which
  -- is what "does not expire" is spelled as — see the note in
  -- src/lib/entitlements.ts about why a cancelled-but-paid-through
  -- subscription must keep working until this passes.
  current_period_end       timestamptz,
  source                   text,
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  updated_at               timestamptz not null default now()
);

-- Constraints added separately so this file stays re-runnable.
alter table public.entitlements drop constraint if exists entitlements_plan_check;
alter table public.entitlements
  add constraint entitlements_plan_check check (plan in ('free', 'pro'));

alter table public.entitlements drop constraint if exists entitlements_status_check;
alter table public.entitlements
  add constraint entitlements_status_check
  check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired'));

alter table public.entitlements drop constraint if exists entitlements_source_check;
alter table public.entitlements
  add constraint entitlements_source_check
  check (source is null or source in ('trial', 'purchase', 'code'));

alter table public.entitlements enable row level security;

-- One policy. Read your own row; that is the whole client-side surface.
--
-- There is no INSERT, UPDATE or DELETE policy here and that is not an
-- oversight: adding one would hand every signed-in student a `update
-- entitlements set plan='pro'` and make the rest of this scheme decorative.
-- The test that guards it lives in src/lib/entitlements.test.ts.
drop policy if exists "read own entitlement" on public.entitlements;
create policy "read own entitlement" on public.entitlements
  for select using (auth.uid() = user_id);

create index if not exists entitlements_period_end_idx
  on public.entitlements (current_period_end);

-- ------------------------------------------------------------ redemption codes
--
-- The plaintext of a code is never stored, here or in the repository. Only a
-- hash goes in this table, inserted by hand through the SQL editor. A master
-- code that reached a browser bundle would unlock Pro for the whole internet
-- with no way to revoke it short of a redeploy.
--
-- Because it is a table rather than a constant, promo codes come free: the
-- same mechanism with a `max_uses` and an `expires_at`.

create table if not exists public.redemption_codes (
  id         uuid primary key default gen_random_uuid(),
  code_hash  text not null,
  label      text,
  grants     text not null default 'pro',
  max_uses   int,
  uses       int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS on, no policies at all: not even readable from a browser. Publishing the
-- hashes would let someone crack them offline at their leisure.
alter table public.redemption_codes enable row level security;

create table if not exists public.redemptions (
  code_id uuid not null references public.redemption_codes on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  at      timestamptz not null default now(),
  primary key (code_id, user_id)
);
alter table public.redemptions enable row level security;

-- --------------------------------------------------------------- webhook log
--
-- Payment providers retry deliveries, and a retried "subscription created" that
-- is applied twice is a double grant or a double charge reconciliation. The
-- primary key is the idempotency guard: the webhook inserts first and stops if
-- the id is already present.

create table if not exists public.webhook_events (
  provider_event_id text primary key,
  provider          text not null,
  kind              text,
  received_at       timestamptz not null default now()
);
alter table public.webhook_events enable row level security;

-- ------------------------------------------------------------- the free trial
--
-- Started by a trigger rather than by the app, for three reasons: the client
-- cannot skip it, it cannot race the sign-in that would otherwise have to fire
-- it, and — the one that matters — a client that could call "start my trial"
-- could call it again next week.
--
-- `security definer` so it runs with the function owner's rights; the trigger
-- fires on a table the caller has no direct access to.

create or replace function public.start_trial()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.entitlements (user_id, plan, status, trial_ends_at, source)
  values (new.id, 'pro', 'trialing', now() + interval '7 days', 'trial')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.start_trial();

-- Backfill: anyone who signed up before this migration existed has no row, and
-- a missing row reads as free. Give them the same 7 days a new account gets.
insert into public.entitlements (user_id, plan, status, trial_ends_at, source)
select id, 'pro', 'trialing', now() + interval '7 days', 'trial'
from auth.users
on conflict (user_id) do nothing;
