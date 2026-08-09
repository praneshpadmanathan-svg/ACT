# Brief: connect ACT Command to Supabase and prove sign-in works end to end

Paste everything below the line into cowork.

---

## What this is

**ACT Command** — a free ACT study app built as a fantasy quest, repo
`praneshpadmanathan-svg/ACT`, deployed on Vercel. Audience is **13–17 year olds**.

**All the auth code is written and shipped.** Nothing in `src/` needs changing.
The app is sitting in local-only mode purely because two environment variables
are unset, so `cloudEnabled` is false and there is nothing to sign in to. Your
job is the configuration around it, and then proving it actually works.

Read [`docs/launch-checklist.md`](launch-checklist.md) in the repo first — it is
the short version of this and it is kept in sync with the code.

## What only the account holder can do

Do **not** attempt these yourself. Ask the owner to do them and hand you the
results:

1. **Create the Supabase account and project** at supabase.com. It needs an
   email confirmation and acceptance of terms, so it has to be them.
2. **Copy the two publishable values** from Settings → API:
   `Project URL` and the `anon` / `publishable` key.
3. **Anything involving the `service_role` key.** They should paste it directly
   into the Supabase CLI or dashboard when required and never into a file, a
   chat, a commit, or a browser bundle. If you ever find yourself about to write
   it somewhere, stop and hand back.

Region choice: pick whichever is closest to most users. It cannot be changed
later without recreating the project.

## Then do the following, in order

### 1. Wire the keys

Local, for development:

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

`.env` is gitignored. **Confirm that** before writing anything into it:

```bash
git check-ignore -v .env
```

Then in Vercel → Project → Settings → Environment Variables, add both for
**Production, Preview and Development**. If they are set only for Production,
preview deploys silently fall back to local-only mode and you will end up
testing the wrong thing and concluding it is broken.

The anon key is _designed_ to ship in a browser bundle and is not a secret.
Row-level security is what protects the data, which is why the next step is not
optional.

### 2. Run the schema

Paste [`supabase/schema.sql`](../supabase/schema.sql) into the SQL editor and run it.

Then verify RLS is actually on, because a table with it off is readable in full
by anyone who views source and copies the anon key:

```sql
select relname, relrowsecurity from pg_class where relname = 'progress';
-- expect: progress | t

select policyname, cmd from pg_policies where tablename = 'progress';
-- expect four rows: SELECT, INSERT, UPDATE, DELETE
```

All four matter. An earlier version of this schema was missing DELETE, which
made "reset my progress" fail silently server-side and left "delete my account"
unable to clear the row at all.

### 3. Auth settings

Dashboard → Authentication. Each of these fails quietly if wrong, which is why
they are written down:

- [ ] **Confirm email** — ON. Without it anyone can sign up as anyone.
- [ ] **Minimum password length** — 8, to match the client.
- [ ] **Leaked password protection** — ON. This is the single highest-value
      switch on the page for an audience that reuses passwords. The client
      refuses the obvious shapes — runs, repeats, the site's own name, the
      user's own email — but it cannot know what is in a breach corpus.
- [ ] **Bot protection (Cloudflare Turnstile)** — ON for sign-up. Bot
      registrations burn the 50,000 monthly-user allowance and fill a 500 MB
      database, and neither is recoverable on the free plan.
- [ ] **Site URL** — the real production domain, exactly.
- [ ] **Redirect URLs** — the production domain plus `http://localhost:5173`.
      **No wildcards.** A permissive redirect list on an auth callback is an
      open redirect, and an open redirect there hands an attacker a token-theft
      path. This is the single most dangerous field on the page.

### 4. Email template, for the six-digit code

The app offers "email me a code instead" as an alternative to a password, which
is materially kinder on a phone than following a link and coming back. That
calls `signInWithOtp`, and the **default template only contains a link**.

Edit the **Magic Link** template and include the token:

```
{{ .Token }}
```

The link keeps working either way, so this is an improvement rather than a
dependency. If you skip it, say so, because the code entry field will then
appear and never accept anything.

### 5. Deploy the delete-account function

Account deletion needs the `service_role` key, which must never reach the
browser. It lives in an Edge Function instead:

```bash
supabase functions deploy delete-account
supabase secrets set SITE_URL=https://the-real-domain,http://localhost:5173
```

`SITE_URL` is a **required** comma-separated allowlist with no trailing slashes.
Unset, the function falls back to localhost only and the deployed site cannot
call it — deliberately. This is the one endpoint that permanently destroys an
account, so it fails closed rather than open.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by the platform. Do not set them, and do not put the service role key in `.env`.

## Then prove it, on the deployed domain

Not on localhost. The redirect allowlist and the PKCE round trip are exactly the
things that behave differently there, and they are the two most likely failures.

Work through this and report what actually happened at each step, including
anything that looked odd:

1. **Sign up** with a real address you control. Confirm you land on
   "check your email".
2. **Open the confirmation link.** You should arrive back _inside the app,
   signed in_ — at the camp or at onboarding, **not** on the marketing landing
   page. Landing on the marketing page means the redirect handling has
   regressed; report it rather than working around it.
3. **Guest progress carries over.** Before signing up, play as a guest and clear
   one landmark. After confirming, that progress must be in the new account.
4. **Sign out, sign in again** with the password. Confirm you are _not_ sent
   through onboarding a second time.
5. **Email me a code instead** — check a six-digit code arrives and works.
   (Only if you did step 4 of the setup.)
6. **Forgot password** → open the link → set a new one → sign in with it.
7. **Second device.** Open the deployed site in a different browser profile,
   sign in, and confirm progress arrives. Then answer a question on each and
   confirm neither wipes the other.
8. **Export** from the profile page. Confirm the file downloads and contains
   real progress.
9. **Delete the account.** Then confirm in the dashboard that **both** the
   `progress` row and the Authentication → Users entry are gone. An account
   deletion that only appears to work is worse than not having one.
10. **Age gate.** With a fresh browser profile, enter a date of birth under 13.
    You should reach guest mode with **no email field anywhere on screen**. Open
    the network tab during the gate and confirm **no request carries a date of
    birth** — it is meant to be used once in memory and discarded.

## Two things to check while you are in there

**Free-tier headroom.** After a few accounts exist, run:

```sql
select pg_size_pretty(sum(pg_column_size(data))) from public.progress;
select pg_size_pretty(pg_column_size(data)) from public.progress order by 1 desc limit 5;
```

A row should be in the low tens of kilobytes. If any row is approaching 256 KB
the size constraint will start rejecting writes, and something is wrong with
what the client is sending — the raw answer log is supposed to stay on the
device. Report the numbers.

**Response headers**, once deployed:

```bash
curl -sI https://the-real-domain | sort
```

Confirm the Content-Security-Policy, HSTS and the rest from `vercel.json` are
present, and that the CSP's `connect-src` permits the Supabase project. A CSP
that blocks the API fails silently in a way that looks like a broken login.

## Rules

- **Never commit `.env`**, and never paste either key into a commit message, a
  comment, or a file that is not gitignored.
- **The `service_role` key goes nowhere near the repo or the browser.** If a
  step seems to need it client-side, that step is wrong — stop and say so.
- **No wildcards in the redirect allowlist**, however convenient.
- If something does not work, **report it rather than routing around it.** A
  workaround in the configuration is invisible from the code and will be
  rediscovered painfully later.

## What done looks like

Someone can open the deployed site on their phone, make an account, study,
open it on a laptop, find their progress waiting, forget their password,
recover it, export everything, and delete the account permanently — and an
under-13 who arrives gets the whole app without ever being asked for an email.

Report which of the ten steps passed, which failed and how, and anything in the
configuration that surprised you.
