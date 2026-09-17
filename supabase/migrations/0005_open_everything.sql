-- Everything is free.
--
-- 0003 and 0004 built a paywall: an entitlements row per user, a table of
-- redemption codes, the attempt log that rate-limited redeeming them, and the
-- webhook ledger a payment processor would have written to. The product no
-- longer sells anything — every section, every test, every duel and the whole
-- review queue are open to anyone, guests included. The client no longer reads
-- an entitlement, so all of this is unread state, and unread state that grants
-- privileges is worth removing rather than leaving for someone to rediscover.
--
-- Migrations are history, so 0003 and 0004 stay on disk. This undoes them.
-- Order matters: the functions reference the tables, and redemptions and
-- redemption_attempts reference redemption_codes.

drop function if exists public.claim_code(uuid, uuid);
drop function if exists public.start_trial();

drop table if exists public.redemption_attempts;
drop table if exists public.redemptions;
drop table if exists public.redemption_codes;
drop table if exists public.webhook_events;
drop table if exists public.entitlements;
