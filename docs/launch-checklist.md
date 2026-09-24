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
editor and run them **in filename order**. There are **five**. `0001` creates the
table and its policies and `0002` adds the compare-and-set write that stops one
device silently overwriting another's work; `0003` and `0004` built the paywall
and `0005` removes it again, because everything is free now.

On a fresh project the last three cancel out, so running only `0001` and `0002`
reaches the same schema. Run all five anyway — the point of a numbered directory
is that the database can say which migrations it has seen, and a project that
skipped three of them cannot.

They are written to be re-runnable, so a project that already has the table can
adopt the migration history without dropping anything. Order still matters —
`0002` defines a function against the table `0001` creates.

Then **confirm RLS is actually on**: Table editor → `progress` → the shield should
read "RLS enabled". The anon key is public by design, so these policies are the
only thing separating one student's progress from another's.

### Then check it, rather than believing it

```bash
npm run supabase:doctor
```

Every other line on this page is a box you tick by hand, and a ticked box is a
claim. This one asks the live project. It reads `.env`, uses nothing but the anon
key, writes nothing, and reports on the things that have actually gone wrong here
before — the table missing, `push_progress` missing, RLS not filtering, email
confirmation quietly off, the delete-account function never deployed. Each failure
comes with its fix.

It earns its keep because the alternative already happened: the project ran live
with neither migration applied, so every sync write failed server-side and nothing
in the repo could say so. Run it after any dashboard change and after any
migration.

It cannot see the _deployment_ either — whether the build that is live was
given those variables at the moment it was built. `npm run check:deploy` asks
the shipped bundle that question.

Three things it cannot see, because they need the Management API and a personal
access token rather than the anon key: the redirect allowlist, the `SITE_URL`
function secret, and the email templates. Those stay hand-checked below.

## 3. Auth settings

### 3a. The ones that are now code

[`supabase/config.toml`](../supabase/config.toml) declares them, so they are
reviewable and diffable instead of being someone's memory of a dashboard visit.
Sign in once, link, **read the diff**, then push:

```bash
npx --yes supabase@2 login
npm run supabase:link
npm run supabase:config-diff
npm run supabase:config-push
```

Only the first one needs a human: it opens a browser and stores a token. Every
command after it, here and in §4, runs off that token.

Do not skip the diff. `config push` leaves undeclared properties alone — that is
what makes it safe against a live project — but a non-interactive run proceeds
without asking, so the diff is the only review step there is.

That applies: **Confirm email ON**, **minimum password length 8**, **Site URL**
`https://act-red.vercel.app`, the **redirect allowlist** (exact URLs, no
wildcards), confirm-both-addresses on an email change, reauth before a password
change, and a six-digit OTP. Each one is commented in the file with the reason.

- [ ] Pushed, and `npm run supabase:doctor` now reports Email confirmation as a pass.

### 3b. The ones that cannot be

Dashboard → Authentication. Neither has a `config.toml` key.

- [ ] **Leaked password protection** — ON. Rejects passwords found in known breaches: the single highest-value switch on this page for an audience that reuses passwords. The client refuses the obvious shapes (runs, repeats, the site's name, the user's own email) but it cannot know what is in a breach corpus, so this is the half that actually matters.
- [ ] **Bot protection (Cloudflare Turnstile)** — ON for sign-up. Bot registrations burn the 50,000-user allowance and fill the database, and neither is recoverable on the free plan. `[auth.captcha]` does exist in `config.toml`, but it requires the provider `secret` inline, and no secret goes in this repository — so this one stays in the dashboard on purpose.

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
npm run supabase:deploy-fn
```

Then set the origins it will accept — **required**, not optional:

```bash
npx --yes supabase@2 secrets set SITE_URL=https://act-red.vercel.app,http://localhost:5173
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
- [ ] **The `VITE_` prefix is the whole thing.** Vite only exposes variables carrying it, so `SUPABASE_URL` and `SUPABASE_ANON_KEY` — the names Supabase's own Vercel integration writes when you connect the two — are invisible to this app. Every name present, none of them matching, and `cloudEnabled` comes out false with no error: the app is built to degrade to local-only, so it does, while the sign-in button stays on screen. Do not assume the integration configured anything.
- [ ] **Delete the keys nothing uses.** That integration also writes `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET` and `POSTGRES_PASSWORD` into the production environment. This is a static build with no server-side code, so nothing legitimate reads them — but the build process can, which means so can anything in the dependency tree at build time. Remove them, and rotate any that have sat there.
- [ ] **Contact addresses**: `VITE_CONTACT_SUPPORT`, and optionally `VITE_CONTACT_PRIVACY` and `VITE_CONTACT_SECURITY` (each falls back to support, which falls back to the personal Gmail in `src/lib/contact.ts`). The privacy policy and terms render whichever address is live, so until these are set the deployment publishes a personal inbox on a public page aimed at minors.
- [ ] **`public/.well-known/security.txt` is static** — no environment variable reaches it, because it is copied verbatim into the build. Edit its `Contact:` line by hand to match, in the same change. `check:deploy` fails when the two disagree, which is the only reason they can be trusted to agree.
- [ ] Prove all of it from outside, rather than from the dashboard:

      npm run check:deploy

  It walks the deployed bundle — every lazily-loaded route chunk, not just the ones the document names — and reports whether a Supabase host is actually in it, whether a `service_role` or secret key leaked into it, which contact address it publishes, whether `security.txt` is served and unexpired and agrees with the bundle, and whether the edge is really sending the headers `vercel.json` declares. A header declared in a repo is not a header on a response, and a variable present in the dashboard is not a variable the build read.

**Vercel Hobby is non-commercial only.** A free study app with no ads and no
payments is fine. The day it earns money — ads, subscriptions, sponsorship — it
has to move to Pro, and this is enforced by account suspension rather than a
polite email.

**Launching on `act-red.vercel.app`, deliberately.** A custom domain is the one
decision here that gets harder after launch rather than easier: links get shared
and indexed, and moving breaks them. The trade was made with that known. Two
things that do _not_ argue against it, so nobody relitigates them later: sessions
live in `localStorage`, which is scoped to this exact origin, so sharing the
`vercel.app` suffix with every other Hobby deployment does not expose them — that
argument is about cookies, and this app sets none; and the redirect allowlist
above is pinned to the full host, not the suffix. When the domain does move, the
list of things to change is exactly: Site URL, the redirect allowlist, the
`SITE_URL` function secret, `Canonical` and `Policy` in `security.txt`, and
`DEFAULT_SITE` in `scripts/check-deploy.mjs`.

## 6. Before you tell anyone

- [ ] Point the contact addresses at an inbox you are happy to have scraped off a public page — the Vercel variables in §5, plus `security.txt` by hand. There is no longer an address to edit in `src/screens/Legal.tsx`; it reads `src/lib/contact.ts` like everything else. Until you do, `npm run check:deploy` warns and the deployed policy names a personal Gmail.
- [ ] Whichever address you choose, **make sure it is monitored**. The privacy policy offers it for data access, correction and deletion requests, and several state privacy laws attach a response window to those. An address that bounces or is never read is a worse position than the personal Gmail, not a better one.
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
