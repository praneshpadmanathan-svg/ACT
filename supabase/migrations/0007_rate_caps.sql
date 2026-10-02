-- 0007 — rate caps on the two tables the public can write to, and the second
-- of those tables: `client_errors`, where the app's crash reports land.
--
-- The problem this exists for. 0006 lets anyone, signed in or not, add a row to
-- `feedback`, and the anon key that allows it ships in the browser bundle. The
-- length caps stop one row being large; nothing stopped there being a million
-- of them. A loop of `insert`s from a script could fill the free tier's 500 MB
-- in an afternoon, and a full database takes sync down for every student, not
-- just the table being flooded. The client's one-a-minute cooldown is a guard
-- against a double tap, not against anybody who opens the console.
--
-- So each publicly-writable table gets a BEFORE INSERT trigger that counts
-- recent rows and refuses the insert past a ceiling:
--
--   feedback       per account   5 an hour, 20 a day
--                  everyone      500 a day in total
--   client_errors  per account   20 an hour, 100 a day
--                  everyone      1000 a day in total
--
-- A guest has no id to count against, so for guests only the global ceiling
-- applies. That is the honest trade: an anonymous flood can use up the day's
-- allowance and lock out real reports until tomorrow, but it cannot grow the
-- database past a known size, which is the thing that would actually hurt.
-- Five hundred feedback rows at the 4,000-character cap is about 2 MB a day.
--
-- Why the functions are `security definer`. The callers (anon, authenticated)
-- have insert and nothing else on these tables, so a trigger running as them
-- could not count rows: without select it errors, and under RLS with no select
-- policy it would count zero and never trip. Running as the owner sees every
-- row. `search_path` is pinned to empty and every name is schema-qualified, so
-- a caller cannot plant a `count` or a table of their own earlier on the path.
--
-- Why the advisory lock. Two inserts arriving together would both count 499
-- and both get in; a burst of fifty would put the ceiling at whatever the
-- concurrency happened to be. A transaction-scoped advisory lock per table
-- makes the count-then-insert atomic. These tables see a handful of rows a
-- day, so serialising their inserts costs nothing anybody could notice.
--
-- The refusal is a plain exception with a stable message — `feedback_rate_limited`
-- or `client_errors_rate_limited` — which PostgREST hands back as the error
-- message. `sendFeedback` in src/lib/supabase.ts matches on it and shows a
-- sentence a person can act on; the crash reporter just drops the report.
--
-- Re-runnable, matching every migration before it.

-- ------------------------------------------------------- feedback: the cap

create index if not exists feedback_user_created_at_idx
  on public.feedback (user_id, created_at desc)
  where user_id is not null;

create or replace function public.feedback_rate_cap()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  recent_hour int;
  recent_day int;
  global_day int;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.feedback_rate_cap'));

  if new.user_id is not null then
    select
      count(*) filter (where f.created_at > pg_catalog.now() - interval '1 hour'),
      count(*)
      into recent_hour, recent_day
      from public.feedback f
      where f.user_id = new.user_id
        and f.created_at > pg_catalog.now() - interval '1 day';

    if recent_hour >= 5 or recent_day >= 20 then
      raise exception 'feedback_rate_limited'
        using hint = 'Too many feedback reports from this account recently. Try again later.';
    end if;
  end if;

  select count(*) into global_day
    from public.feedback f
    where f.created_at > pg_catalog.now() - interval '1 day';

  if global_day >= 500 then
    raise exception 'feedback_rate_limited'
      using hint = 'The daily ceiling for feedback has been reached. Try again tomorrow.';
  end if;

  return new;
end;
$$;

-- A trigger function is never meant to be called directly. Nobody but the
-- owner needs execute on it; the trigger fires regardless of the caller's
-- grants.
revoke all on function public.feedback_rate_cap() from public, anon, authenticated;

drop trigger if exists feedback_rate_cap on public.feedback;
create trigger feedback_rate_cap
  before insert on public.feedback
  for each row execute function public.feedback_rate_cap();

-- ------------------------------------------------- client_errors: the table
--
-- Crash reports from the app itself: uncaught errors, unhandled promise
-- rejections and render crashes caught by the error boundary. The reporter is
-- src/lib/report.ts; it sends at most five a page load, never the same message
-- twice in a browser session, and strips query strings, URL fragments, email
-- addresses and anything shaped like a token before anything leaves the device.
--
-- Same shape as `feedback`: insert-only from outside. There is no select,
-- update or delete policy and no grant for them, so the API refuses all three
-- — a stack trace can describe somebody's session, and nobody but the operator
-- needs to read one. You read them in Table editor -> client_errors, which
-- bypasses RLS.
--
-- `user_id` is never taken from the client: the column grant leaves it out and
-- the default fills it from the session, which the policy then re-checks.
--
-- Every text column is capped, the stack hardest of all, so the worst case is
-- about 3 KB a row. At the 1,000-a-day ceiling and 30 days' retention that is
-- under 100 MB — a fifth of the free tier, and only if someone is trying.

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  build_id text check (build_id is null or char_length(build_id) <= 64),
  route text check (route is null or char_length(route) <= 120),
  message text not null check (char_length(message) between 1 and 500),
  stack text check (stack is null or char_length(stack) <= 2000),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400)
);

alter table public.client_errors enable row level security;

revoke all on public.client_errors from anon, authenticated;
grant insert (build_id, route, message, stack, user_agent)
  on public.client_errors to anon, authenticated;

drop policy if exists "anyone can report a crash" on public.client_errors;
create policy "anyone can report a crash"
  on public.client_errors
  for insert
  to anon, authenticated
  with check (user_id is not distinct from auth.uid());

create index if not exists client_errors_created_at_idx
  on public.client_errors (created_at desc);
create index if not exists client_errors_user_created_at_idx
  on public.client_errors (user_id, created_at desc)
  where user_id is not null;

-- --------------------------------------------- client_errors: cap and prune
--
-- Retention is 30 days, and the privacy policy says so. pg_cron is not
-- enabled on this project, so the trigger does the pruning itself: on roughly
-- one insert in twenty it deletes everything older than 30 days. On the index
-- that is a range scan of nothing on almost every run, and it means retention
-- holds even if nobody ever remembers the manual query in
-- docs/launch-checklist.md. A quiet month with no crashes leaves old rows in
-- place until the next one, which is the right way round: no new reports, no
-- growth.

create or replace function public.client_errors_rate_cap()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  recent_hour int;
  recent_day int;
  global_day int;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.client_errors_rate_cap'));

  if pg_catalog.random() < 0.05 then
    delete from public.client_errors e
      where e.created_at < pg_catalog.now() - interval '30 days';
  end if;

  if new.user_id is not null then
    select
      count(*) filter (where e.created_at > pg_catalog.now() - interval '1 hour'),
      count(*)
      into recent_hour, recent_day
      from public.client_errors e
      where e.user_id = new.user_id
        and e.created_at > pg_catalog.now() - interval '1 day';

    if recent_hour >= 20 or recent_day >= 100 then
      raise exception 'client_errors_rate_limited';
    end if;
  end if;

  select count(*) into global_day
    from public.client_errors e
    where e.created_at > pg_catalog.now() - interval '1 day';

  if global_day >= 1000 then
    raise exception 'client_errors_rate_limited';
  end if;

  return new;
end;
$$;

revoke all on function public.client_errors_rate_cap() from public, anon, authenticated;

drop trigger if exists client_errors_rate_cap on public.client_errors;
create trigger client_errors_rate_cap
  before insert on public.client_errors
  for each row execute function public.client_errors_rate_cap();

-- ------------------------------------------ progress.display_name: a ceiling
--
-- The third column the public writes, and the one with no bound. It is
-- whatever was typed into the name field at sign-up, sent on every push, and
-- `push_progress` stored it as given — so a script holding a valid session
-- could park a megabyte of text in it on every write, and the data-size check
-- in 0001 only covers `data`. 64 characters is far past any real name; the
-- client cuts to the same length (MAX_DISPLAY_NAME in src/lib/supabase.ts).
--
-- Order matters for re-running and for an existing project: shorten anything
-- already over the line, then add the check NOT VALID (no full-table lock
-- while it is added), then validate it, which only reads.

update public.progress
   set display_name = left(display_name, 64)
 where char_length(display_name) > 64;

alter table public.progress drop constraint if exists progress_display_name_length;
alter table public.progress
  add constraint progress_display_name_length
  check (display_name is null or char_length(display_name) <= 64) not valid;
alter table public.progress validate constraint progress_display_name_length;

-- And `push_progress` truncates rather than lets the check refuse the write.
-- A refused push is a student's progress not reaching the cloud, which is a
-- far worse outcome than a shortened name. Identical to 0002 except for the
-- `left(...)` on the two writes — still security invoker, still a fixed
-- search_path, still no user_id parameter. `create or replace` keeps the
-- grants and the comment 0002 set.

create or replace function public.push_progress(
  p_display_name text,
  p_data         jsonb,
  p_expected     timestamptz
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_now  timestamptz := now();
  v_seen timestamptz;
  v_out  timestamptz;
  v_name text := left(p_display_name, 64);
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select updated_at into v_seen from public.progress where user_id = v_uid;

  if v_seen is distinct from p_expected then
    return null;
  end if;

  if v_seen is null then
    insert into public.progress (user_id, display_name, data, updated_at)
    values (v_uid, v_name, p_data, v_now)
    returning updated_at into v_out;
  else
    update public.progress
       set display_name = v_name,
           data         = p_data,
           updated_at   = v_now
     where user_id = v_uid
       and updated_at = v_seen
    returning updated_at into v_out;
  end if;

  return v_out;

exception
  when unique_violation then
    return null;
end;
$$;

revoke all on function public.push_progress(text, jsonb, timestamptz) from public;
grant execute on function public.push_progress(text, jsonb, timestamptz) to authenticated;
