# Launch checklist

Everything here is configuration rather than code, which is exactly why it needs
writing down: none of it is visible in the repo, none of it is caught by a
typecheck, and getting it wrong fails quietly. Work top to bottom.

---

## 1. Create the Supabase project

Free tier, and the limits are worth knowing before you pick a region:

|                      | Free plan                                |
| -------------------- | ---------------------------------------- |
| Monthly active users | 50,000                                   |
| Database             | 500 MB                                   |
| Egress               | 5 GB                                     |
| Projects             | 2 active                                 |
| Inactivity           | **Paused after 7 days with no requests** |

That last row matters in the quiet week between deploying and telling anyone —
a paused project has to be restored by hand from the dashboard. Once real people
are using it, it never triggers.

**The database is the binding limit, not the user count.** Measured against a
deliberately heavy account — 2,000 answers, all 37 zones cleared, 86 topics
touched, 754 questions in the review queue, 60 tests sat:

|                                  | Row size  | Gzipped  | Users per 500 MB |
| -------------------------------- | --------- | -------- | ---------------- |
| Syncing the raw answer log (old) | 302 KB    | 25 KB    | ~1,700           |
| Syncing the summary (now)        | **54 KB** | **7 KB** | **~9,400**       |

Uncompressed, ~9,400 heavy users fill the free database. Postgres TOAST-compresses
large `jsonb` and this data is extremely repetitive, so the practical number is
several times that — comfortably past the 50,000-user auth ceiling, which is
where you want the binding limit to sit.

What is left is mostly irreducible: 31 KB of it is the spaced-repetition queue,
which holds one entry per question you have answered and not yet retired, and 13 KB
is your last 50 test results. Both are real data someone would miss.

Don't undo this by syncing `attempts` — see the note on `CloudProgress` in
`src/lib/supabase.ts`. The `progress_data_size` constraint in the schema caps a
row at 256 KB, about five times the realistic worst case, so a bug cannot quietly
fill the database for everyone else.

## 2. Run the migrations

Paste each file in [`supabase/migrations/`](../supabase/migrations/) into the SQL
editor and run them **in filename order**. There are two: `0001` creates the table
and its policies, `0002` adds the compare-and-set write that stops one device
silently overwriting another's work.

They are written to be re-runnable, so a project that already has the table can
adopt the migration history without dropping anything. Order still matters —
`0002` defines a function against the table `0001` creates.

Then **confirm RLS is actually on**: Table editor → `progress` → the shield should
read "RLS enabled". The anon key is public by design, so these policies are the
only thing separating one student's progress from another's.

## 3. Auth settings

Dashboard → Authentication.

- [ ] **Confirm email** — ON. Without it anyone can sign up as anyone.
- [ ] **Minimum password length** — 8. (The client enforces 8; make the server agree.)
- [ ] **Leaked password protection** — ON. Rejects passwords found in known breaches: the single highest-value switch on this page for an audience that reuses passwords. The client refuses the obvious shapes (runs, repeats, the site's name, the user's own email) but it cannot know what is in a breach corpus, so this is the half that actually matters.
- [ ] **Bot protection (Cloudflare Turnstile)** — ON for sign-up. Bot registrations burn the 50,000-user allowance and fill the database, and neither is recoverable on the free plan.
- [ ] **Site URL** — the real domain, exactly.
- [ ] **Redirect URLs** — the real domain, plus `http://localhost:5173` for development. **No wildcards.** A permissive redirect list is an open redirect, and an open redirect on an auth callback hands attackers a token-theft path.

### Email templates

The app asks Supabase to send a **six-digit code** as well as a link
(`sendLoginCode` in `src/lib/supabase.ts`). The default template only contains a
link. To make the code path work, edit the **Magic Link** template and include:

```
{{ .Token }}
```

The link keeps working either way — the code is the nicer option on a phone,
where following a link means leaving the browser and coming back.

## 4. Deploy the delete-account function

Account deletion needs the `service_role` key, which must never be in the
browser bundle. It lives in an Edge Function instead:

```bash
supabase functions deploy delete-account
```

Then set the origins it will accept — **required**, not optional:

```bash
supabase secrets set SITE_URL=https://your-domain,http://localhost:5173
```

Comma-separated, no trailing slashes. If this is unset the function falls back to
localhost only and your deployed site cannot call it, which is the intended
failure: this is the one endpoint that permanently destroys an account, and a
wildcard origin on it would let any page on the internet invoke it with a token
it happened to get hold of. Better it breaks visibly than opens quietly.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by the platform — do not set them yourself, and do not put the service role key
anywhere near `.env`.

**Verify it before launch.** Make a throwaway account, delete it from the profile
screen, and confirm both that the `progress` row is gone and that the user is
gone from Authentication → Users. An account-deletion button that only appears to
work is worse than not having one.

## 5. Vercel

- [ ] Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Set them for **all** environments, or preview builds silently fall back to local-only mode and you will test the wrong thing.
- [ ] Confirm the deployed response carries the security headers from `vercel.json` (`curl -sI https://your-domain | sort`).

**Vercel Hobby is non-commercial only.** A free study app with no ads and no
payments is fine. The day it earns money — ads, subscriptions, sponsorship — it
has to move to Pro, and this is enforced by account suspension rather than a
polite email.

## 6. Before you tell anyone

- [ ] Set `CONTACT_EMAIL` in `src/screens/Legal.tsx` to an address you are happy to have scraped off a public page. It is currently a personal Gmail.
- [ ] Read the privacy policy and terms end to end and check every sentence is still true of the build you are shipping. A policy that over-promises is a false statement, not a missing one.
- [ ] Have someone qualified look at both. They describe real obligations to real minors, and I am not a lawyer.
- [ ] Sign up, confirm the email, sign out, sign in, reset the password, sign in with the new one — on the actual deployed domain, not localhost. This is where the redirect allowlist and the PKCE round trip fail if they are going to.
- [ ] Enter a birthday under 13 and confirm you land in guest mode with no email field on screen.
- [ ] Open the network tab during the age gate and confirm no request carries a date of birth.

---

## The trademark line

"ACT" is a registered trademark of ACT, Inc. This app is not affiliated with
them, and the terms page says so plainly. Keep it that way: describing what the
material covers is fine, implying endorsement or using their branding is not.
