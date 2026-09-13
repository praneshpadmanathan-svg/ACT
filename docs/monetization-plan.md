# Free trial, Pro at $4.99/mo, and a master unlock code

A plan, not an implementation. Decisions marked **OPEN** need your call before
the phase that depends on them.

Chosen already: a **merchant-of-record** processor (not raw Stripe), and a
**7-day full-access trial** rather than a permanently-capped free tier.

---

## 0. Read this first — the thing that decides everything else

**Every question and every answer already ships to the browser.**

```
dist/assets/content-xDzbuL8C.js   941 kB   637 × "answer":"<key>"
```

ACT Command is a static SPA. There is no server between the visitor and the
content — Vercel serves the bundle, and Supabase only stores progress. So a
`<ProGate>` around the Math road hides the *button*, not the *questions*.
Anyone who opens devtools, or just fetches that one URL, has the entire bank
including the answer keys. This is not a bug in the gate; it is what a static
site is.

That leaves two honest options, and they lead to different amounts of work:

**Option A — accept cosmetic gating.** Sell the *app*, not the *file*: the
scheduling, the spaced-review queue, the timed test engine, the progress
model, the duels. Nobody who would have paid $4.99 is going to hand-parse a
minified JSON blob to avoid it. Most indie study apps ship exactly this.
Cost: nothing. Risk: a competitor can lift your bank in one request — which
is already true today and will stay true whether or not you charge.

**Option B — move Pro content behind an authenticated endpoint.** Split the
content bundle: free content stays static, Pro content moves to a Supabase
Edge Function that checks the caller's entitlement before returning items.
Cost: a real chunk of work — a content API, a caching story, and the offline
service worker has to learn that some content is fetched rather than bundled.
It also weakens the offline-first behaviour you currently have.

**OPEN #1 — A or B.** My recommendation is **A**, for now. It is the same
choice you already made implicitly by shipping the bank publicly, the
conversion story ("the app is worth $4.99", not "the questions are secret")
is the more durable one anyway, and B is a large piece of work that can be
done later without redoing any of the entitlement plumbing below. Everything
else in this plan is identical either way.

---

## 1. Processor

You picked merchant of record. That is the right call for a solo dev: they
become the seller of record, so **they** register for VAT/GST, collect it,
remit it, and issue invoices. You never touch a tax threshold. The cost is
roughly 5% + 50¢ against Stripe's 2.9% + 30¢ — on $4.99 that is about **$4.24
net instead of $4.54**. Thirty cents a month per subscriber to never think
about EU VAT is a good trade.

Two candidates:

| | Paddle | Lemon Squeezy |
|---|---|---|
| Standing | Independent, established, enterprise-grade | Acquired by Stripe in 2024 |
| DX | Heavier API, more onboarding friction | Noticeably nicer to build against |
| Approval | Manual review of your site before you can sell | Faster |

**Recommendation: Paddle**, on longevity grounds — Lemon Squeezy is now a
Stripe property and I would not want your billing to sit on a product whose
roadmap you cannot see. Verify Lemon Squeezy's current standing yourself
before ruling it in; my information here may be out of date, and if it is
still being actively developed its DX advantage is real.

**OPEN #2 — Paddle or Lemon Squeezy.**

Either way, the integration surface is the same three things: a hosted
checkout URL, a signed webhook, and a customer portal link. Nothing below
changes between them except the field names inside `src/lib/payments/`.

---

## 2. Where entitlement lives

The rule that makes this secure is one line: **the client can read its
entitlement and can never write it.**

### New table

```sql
create table public.entitlements (
  user_id                  uuid primary key references auth.users on delete cascade,
  plan                     text not null default 'free' check (plan in ('free','pro')),
  status                   text not null default 'trialing'
                             check (status in ('trialing','active','past_due','canceled','expired')),
  trial_ends_at            timestamptz,
  current_period_end       timestamptz,
  source                   text check (source in ('trial','purchase','code')),
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  updated_at               timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- Exactly one policy. Read your own row; that is all.
create policy "read own entitlement" on public.entitlements
  for select using (auth.uid() = user_id);
```

**No INSERT, UPDATE or DELETE policy is written — deliberately.** With RLS on
and no policy for a verb, that verb is denied to every client. Only the
`service_role` key, which lives in Edge Function environments and never in a
browser bundle, can write here. This is the same reasoning already documented
at the top of `supabase/functions/delete-account/index.ts`, and the same
reasoning behind the comment in `supabase/migrations/0001_initial_schema.sql`
that "a table with RLS disabled is a table anyone on the internet can read".

Follow the existing convention: this is `0003_entitlements.sql`, written to be
safely re-runnable.

### Supporting tables

```sql
-- Master / promo codes. The plaintext code is NEVER stored, here or anywhere.
create table public.redemption_codes (
  id         uuid primary key default gen_random_uuid(),
  code_hash  text not null,          -- bcrypt or argon2id
  label      text,                   -- 'owner master', 'launch promo'
  grants     text not null default 'pro',
  max_uses   int,                    -- null = unlimited
  uses       int not null default 0,
  expires_at timestamptz
);
alter table public.redemption_codes enable row level security;  -- no policies: server only

create table public.redemptions (
  code_id uuid references public.redemption_codes on delete cascade,
  user_id uuid references auth.users on delete cascade,
  at      timestamptz not null default now(),
  primary key (code_id, user_id)
);
alter table public.redemptions enable row level security;

-- Webhook idempotency. Providers retry; without this a retry double-applies.
create table public.webhook_events (
  provider_event_id text primary key,
  provider          text not null,
  received_at       timestamptz not null default now()
);
alter table public.webhook_events enable row level security;
```

### Starting the trial

A Postgres trigger on `auth.users` insert, not client code:

```sql
create function public.start_trial() returns trigger
  language plpgsql security definer as $$
begin
  insert into public.entitlements (user_id, plan, status, trial_ends_at, source)
  values (new.id, 'pro', 'trialing', now() + interval '7 days', 'trial')
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.start_trial();
```

A trigger rather than an app call because it cannot be skipped, cannot race a
sign-in, and cannot be replayed by a client to reset its own trial.

Note the trial is per *account*, and nothing stops someone making a second
account. Accept that — every fix for it is worse than the problem.

---

## 3. Edge Functions

Three new ones, alongside the existing `delete-account`. Copy its structure:
verify the caller's own JWT, take the user id from the decoded token and never
from the request body, and keep the `SITE_URL` CORS allowlist.

**`supabase/functions/checkout/index.ts`** — authenticated. Creates a hosted
checkout for the signed-in user, embedding `user_id` in the provider's custom
data so the webhook can find them again. Returns a URL for the client to open.
It does not take a price or a plan from the request; the price lives in the
function's own environment. A client that can name its own price is a client
that can buy Pro for zero.

**`supabase/functions/payments-webhook/index.ts`** — public, but the first
thing it does is verify the provider's signature and reject anything that
fails. Then: insert into `webhook_events` and bail out silently if the id is
already there (that is the idempotency guard), map the event to a status, and
upsert `entitlements` with the service role. Handles subscription created,
updated, cancelled, payment failed, refunded.

**`supabase/functions/redeem-code/index.ts`** — authenticated. See §4.

Secrets go in with `supabase secrets set`, never in the repo, never in a
`VITE_` variable (anything prefixed `VITE_` is compiled into the browser
bundle by design):

```
PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_PRICE_ID
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform
already, as the `delete-account` header notes.

---

## 4. The master code

This is the part that is easiest to get catastrophically wrong, so it is worth
being explicit: **the code must never appear in the client.** Not in a `.env`
with a `VITE_` prefix, not in a constant, not in a comparison. Everything the
browser can execute, a person can read — the whole bundle is right there, and
a master code found in it unlocks Pro for the entire internet, permanently,
with no way to revoke it short of a redeploy.

So:

1. Generate a long random code once, locally — 24+ characters of base32 is
   enough that brute force is not a threat even without a rate limiter.
   You keep the plaintext in your password manager. It is never typed into
   this repo.
2. Hash it (bcrypt or argon2id) and insert **only the hash** into
   `redemption_codes`, by hand, through the Supabase SQL editor.
3. `redeem-code` takes a submitted code, hashes it, compares against
   non-expired rows with uses remaining, and on a match writes a `redemptions`
   row and upserts the user's entitlement to `plan='pro'`, `status='active'`,
   `source='code'`, `current_period_end = null` (null meaning "does not
   expire" — the client treats a null period end on an active row as
   permanent).
4. Rate-limit redemption attempts per user — 5 per hour is plenty. Defence in
   depth; the entropy is doing the real work.

Because it is a table and not a constant, you get promo codes for free: same
mechanism, a `max_uses` and an `expires_at`, a different label.

---

## 5. Client side

**`src/lib/payments/`** — new directory, and the *only* place in the app that
knows a payment provider exists. This is your existing rule and it is worth
keeping: it means swapping Paddle for something else later touches one folder.
Exports `startCheckout()`, `openBillingPortal()`, `redeemCode(code)`. Nothing
outside it imports the provider's SDK or references its URLs.

**`src/lib/entitlements.ts`** — reads the row, derives the boolean:

```ts
isPro = (status === 'active')
     || (status === 'trialing' && trialEndsAt > now)
     || (status === 'canceled' && currentPeriodEnd > now)  // paid through
```

Note the third case: a cancelled subscription keeps Pro until the period they
already paid for runs out. Getting that wrong is the single most common
billing complaint.

**Offline.** The app works fully offline today and that must not regress.
Cache the last known entitlement locally *with its own freshness stamp*, and
honour it while offline for a bounded window — 7 days is reasonable. Never
honour an unbounded stale cache, and never store a bare `isPro: true` boolean
that survives a sign-out.

**`<ProGate>`** in `src/components/` — renders children for Pro, and an upsell
panel otherwise. It should feel like the rest of the app, not like a paywall
bolted on: the locked-zone sigil pattern already in `Study.tsx` is the right
visual language.

---

## 6. What is free and what is Pro

A proposal, sized against what actually exists (637 questions, 37 lessons and
mini-quizzes, 14 note articles, 4 section tests plus a full test, 4 duels, the
Leitner review queue, the Codex):

| | Free (after trial) | Pro |
|---|---|---|
| Study roads | English only | all four |
| Drills | English topics | all topics |
| Library | the 5 English notes | all 14 |
| Summit | — | section tests + full test |
| Duels | — | all four guardians |
| Review | — | the spaced-repetition queue |
| Progress | basic totals | full analytics, topic breakdown, score estimate |
| Tools | — | scratch paper, calculator |
| Codex | free | free |

Reasoning: give away enough that the app is genuinely useful and the quality
is obvious, and put the *systems* — review scheduling, timed tests, analytics
— behind the wall, because those are the things that take work to build and
cannot be lifted out of a JSON file.

**OPEN #3 — tune this table.** It is the most subjective thing here.

**Guest mode stays free forever.** A guest has no account, so it can hold no
entitlement; it is the free tier by construction. The trial CTA is what
converts a guest into an account.

---

## 7. UI work

- Landing (`src/screens/Landing.tsx`) — a pricing block. It already has the
  region-card visual language to reuse.
- A trial countdown where it will actually be seen — the Camp screen, or the
  HUD block in `Shell.tsx`. "4 days of Pro left", not a nag banner.
- A trial-ended state that is a door, not a wall.
- Settings (`src/components/Settings.tsx`) — "Redeem a code" field, and
  "Manage billing" once subscribed.
- Profile (`src/screens/Stats.tsx`) — show the current plan.
- Legal (`src/screens/Legal.tsx`) — Terms needs billing, renewal,
  cancellation and refund clauses. The merchant of record handles tax, but
  the refund policy text is still yours to write.

---

## 8. Order of work

Deliberately arranged so that the thing you asked for personally — a master
code that unlocks Pro — lands **before** any payment integration, and so that
the first two phases have no external dependency and no money involved.

**Phase 1 — entitlement, trial, gating.** Migration `0003`, the trigger,
`entitlements.ts`, `<ProGate>`, the free/Pro split, trial countdown, the
trial-ended state. Fully testable with no processor account and no cost. At
the end of this phase the app has a working two-tier model where the only way
to be Pro is to be in your trial.

> **Phase 1 is done.** Shipped: `supabase/migrations/0003_entitlements.sql`,
> `src/lib/entitlements.ts` (+ 20 tests), `src/lib/features.ts`,
> `src/components/ProGate.tsx`, store wiring, the HUD trial pill and the plan
> panel on Profile. Gates are on the **routes**, not just the links: every
> locked subject is reachable by URL, so `path`, `zone`, `drills`, `drill`,
> `notes` and `note` each check for themselves, and `tests`, `test`, `review`,
> `duels` and `boss` are whole-feature gates. Verified in both themes across
> 27 routes with zero contrast failures and zero console errors.
>
> Two changes to the offer as written above, both made while placing the gates:
>
> 1. **`tools` was dropped from the paid set.** The `ToolDock` lives in
>    `QuestionRunner`, so it appears in *every* quiz — and with the Summit
>    already Pro, gating it could only have removed scratch paper from a free
>    English drill. That is not a reason to subscribe. Four features remain,
>    each a whole system the free tier genuinely does without.
> 2. **The daily challenge is scoped to unlocked subjects.** It was the one
>    screen reaching across all four sections at once, so on the free tier its
>    top-up step served questions from roads the student cannot open.
>    `pickDaily` now takes an optional allow-list; the daily itself stays free,
>    because it is the ninety-second habit the whole app is built around.
>
> Also fixed in passing: `trialDaysLeft` returned `0` for a trial that had
> already ended, which reads as "a trial with no days left" rather than "no
> trial" — the plan panel duly described an expired trial as a running one
> while the header beside it said Unlock Pro. `0` now means only "ends
> tonight"; `trialExpired` answers the other question.

**Phase 2 — the master code.** `redeem-code` function, the codes tables, the
Settings field. **At the end of this phase you can unlock Pro on any account,
permanently, whenever you like.** No processor needed.

> **Phase 2 is done.** Shipped: `supabase/migrations/0004_redeem.sql` (the
> attempt log and the `claim_code` function), `supabase/functions/redeem-code/`,
> `scripts/make-code.mjs`, `redeemCode()` in `src/lib/entitlements.ts`, and the
> `RedeemField` on the Profile plan panel — plus `src/lib/redemption.test.ts`
> (10 tests). Deploy steps are in
> [cowork-supabase-setup.md §6](./cowork-supabase-setup.md).
>
> **PBKDF2 instead of bcrypt**, deviating from §4 as written. bcrypt would have
> meant hashing the code inside a SQL `insert`, which puts the plaintext into
> the Supabase SQL editor's query history — where it stays, visible to anyone
> who can open the project. PBKDF2 is in Web Crypto, so the same primitive is
> available to plain Node and to Deno with nothing installed: the generator
> hashes on your own machine and only the digest is ever pasted into the
> dashboard. The stored value is self-describing —
> `pbkdf2-sha256$<iterations>$<salt>$<hash>` — so the cost travels with each row
> and raising it later does not invalidate codes already issued.
>
> The iteration count is deliberately moderate (100k). A slow KDF exists to make
> guessing a *low-entropy* secret expensive; these codes carry 125 bits from a
> CSPRNG, so the entropy is what stops a guess, not the hash. Cranking it higher
> would mostly hand anyone with an account a way to burn server CPU per request.
>
> Three things the implementation added that the plan did not call for:
>
> 1. **A rate limiter that fails closed.** `redemption_attempts` counts five per
>    account per hour, checked *before* any hashing so a flood costs a row count
>    rather than a KDF, and logged *before* the work rather than after — a
>    request abandoned mid-hash would otherwise cost an attacker nothing.
>    If the limiter table cannot be read, the request is refused rather than
>    waved through.
> 2. **The uses-counter race closed in one statement.** `claim_code` does the
>    increment as a conditional `UPDATE` inside a `security definer` function, so
>    a `max_uses = 1` code pasted by two people at the same moment cannot pass
>    twice. The function is revoked from `anon` and `authenticated`: it takes a
>    code *id*, and ids are not secret — left callable it would be exactly the
>    "set my own plan to pro" endpoint 0003 avoided providing.
> 3. **Unknown and exhausted return identical wording.** Distinguishing them
>    turns guessing into a search with feedback.
>
> The client holds no opinion about codes at all — it posts the string and
> believes the server, then re-reads the entitlement rather than assuming what
> was granted. `redemption.test.ts` pins that as an invariant, along with a
> known-answer vector proving the Node generator and the Deno verifier agree on
> the exact bytes.

**Phase 3 — payment.** Processor account and approval, `checkout` +
`payments-webhook`, pricing UI, sandbox testing. This is the phase with an
external dependency and a review queue, which is why it is not first.

**Phase 4 — lifecycle.** Cancellation, `past_due` dunning, refunds, the
billing portal, plan changes.

---

## 9. Tests worth writing

- **RLS is the load-bearing one.** A test that signs in as a real user and
  attempts `update entitlements set plan='pro'` on their *own* row, and
  asserts it fails. If that test ever passes, the entire scheme is decorative.
- Webhook idempotency: post the same `provider_event_id` twice, assert one
  entitlement change.
- Webhook signature: post a body with a bad signature, assert rejection.
- Trial boundary: entitlement at `trial_ends_at` minus a second and plus a
  second.
- Cancelled-but-paid-through: `status='canceled'` with a future
  `current_period_end` still reads as Pro.
- `redeem-code`: wrong code, expired code, exhausted `max_uses`, replay by the
  same user.
- Offline: stale cache inside the window grants Pro, outside it does not.

---

## 10. Open decisions

1. **Cosmetic gating (A) or server-side content (B)?** — §0. Recommend A.
2. **Paddle or Lemon Squeezy?** — §1. Recommend Paddle; verify LS's current
   standing first.
3. **The free/Pro split** — §6.
4. **Monthly only, or annual too?** An annual plan at ~$39 improves cash flow
   and cuts churn, and costs one more price id. Not assumed above.
