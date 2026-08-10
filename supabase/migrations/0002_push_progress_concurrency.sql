-- 0002 — make a push refuse to overwrite a row it has not seen.
--
-- The problem this closes.
--
-- Syncing is pull, merge, push. Between the pull and the push there is a window
-- — in practice several seconds, because the push is on a 4 s debounce — and a
-- second device writing inside that window loses. The old client called a plain
-- `upsert`, which is unconditional: it writes whatever it is holding over
-- whatever is there. Two devices open on the same account, both mid-session,
-- and the slower one silently erases the faster one's work. Nothing errors,
-- nothing is logged, and the student sees a day of drills disappear.
--
-- Merging is what makes this recoverable rather than catastrophic (see
-- `mergeProgress`: max-of-counters, union-of-sets), so the loss is usually
-- partial rather than total. That is not a reason to allow it.
--
-- The fix is a compare-and-set. The client sends the `updated_at` it last saw;
-- the write only happens if the row still carries that timestamp. If it does
-- not, the function returns null and the client pulls, re-merges and tries
-- again with the newer value in hand.
--
-- Why a function rather than `.eq('updated_at', …)` on an upsert: PostgREST's
-- upsert has no conditional form. A filtered UPDATE could do it, but then the
-- first-ever write (no row yet) needs a separate INSERT and the choice between
-- them is itself a race. Doing both inside one statement-level function makes
-- the decision atomic.
--
-- `security invoker` — deliberately. The function runs as the caller, so all
-- four RLS policies from 0001 still apply, and the row it touches is chosen
-- from `auth.uid()` rather than from anything the client sent. There is no
-- user_id parameter: you cannot name someone else's row through this.

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
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select updated_at into v_seen from public.progress where user_id = v_uid;

  /* `is distinct from` rather than `=`, so the null case is handled by the same
     comparison: a client that expects no row (null) and finds none agrees, and
     a client that expects no row but finds one has lost the race — which is
     exactly what happens when two fresh devices sign in at once. */
  if v_seen is distinct from p_expected then
    return null;
  end if;

  if v_seen is null then
    insert into public.progress (user_id, display_name, data, updated_at)
    values (v_uid, p_display_name, p_data, v_now)
    returning updated_at into v_out;
  else
    /* The `updated_at = v_seen` predicate is not redundant with the check
       above. Between the SELECT and here another transaction can commit; then
       this matches zero rows, `v_out` stays null, and the caller is told to
       retry. Without it the window is real, just narrow. */
    update public.progress
       set display_name = p_display_name,
           data         = p_data,
           updated_at   = v_now
     where user_id = v_uid
       and updated_at = v_seen
    returning updated_at into v_out;
  end if;

  return v_out;

exception
  /* The other side of the same race, for the insert branch: two devices both
     saw no row and both inserted. One wins on the primary key; the loser is a
     conflict, not an error worth showing anyone. */
  when unique_violation then
    return null;
end;
$$;

comment on function public.push_progress(text, jsonb, timestamptz) is
  'Compare-and-set write of the caller''s progress row. Returns the new '
  'updated_at, or null when the row has changed since p_expected — in which '
  'case the caller must pull, merge and retry.';

revoke all on function public.push_progress(text, jsonb, timestamptz) from public;
grant execute on function public.push_progress(text, jsonb, timestamptz) to authenticated;
