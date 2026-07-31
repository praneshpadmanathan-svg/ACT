/* Who the current progress belongs to.

   This file used to be `localAuth.ts`, and it used to implement sign-in: an
   email and a salted SHA-256 password hash written to localStorage. It was
   honest about being profile separation rather than security, but shipping it
   to the public was not defensible. SHA-256 is a *fast* hash — a stolen
   localStorage dump is crackable offline at billions of guesses a second — and
   the people typing into that form are 13 to 17 years old and will reuse a
   password they care about elsewhere.

   Real sign-in is now Supabase's problem, where it belongs: the password is
   hashed server-side with bcrypt and never touches this machine. What survives
   here is the part that was always worth keeping — scoping saved progress to
   whoever earned it, so two people sharing a browser cannot overwrite each
   other. */

import { readJSON, readRaw, removeRaw, writeRaw } from './storage';

/** Whose progress is loaded. */
export type Identity = { kind: 'guest' } | { kind: 'cloud'; userId: string };

export function progressKeyFor(identity: Identity): string {
  return identity.kind === 'cloud'
    ? `act-command:progress:v2:cloud:${identity.userId}`
    : 'act-command:progress:v2:guest';
}

/* ------------------------------------------------- retiring device accounts */

const LEGACY_ACCOUNTS = 'act-command:accounts';
const LEGACY_SESSION = 'act-command:local-session';
const LEGACY_MIGRATED = 'act-command:device-accounts-retired';

const legacyProgressKey = (email: string) => `act-command:progress:v2:local:${email}`;

/** Shape of what the old build wrote. Only `email` is still of any use. */
interface LegacyAccount {
  email: string;
  name: string;
}

/**
 * Retire the on-device credential store, once, on boot.
 *
 * Deliberately conservative about the two halves:
 *
 * - **Credentials are deleted.** Password hashes have no purpose now and every
 *   day they sit in localStorage is a day they can leak. This is the whole
 *   point of the migration.
 * - **Progress is not.** The signed-in profile's progress is copied to the
 *   guest key so the player opens the app and finds their world where they left
 *   it. Any *other* profile's progress is left on disk untouched — it is a few
 *   kilobytes, and quietly deleting someone's work to tidy up a storage key is
 *   not a trade worth making.
 *
 * Returns the display name of the migrated profile, so the UI can explain
 * itself once instead of silently changing under them.
 */
export function retireDeviceAccounts(): { migratedName: string } | null {
  if (readRaw(LEGACY_MIGRATED) === '1') return null;

  const accounts = readJSON<Record<string, LegacyAccount>>(LEGACY_ACCOUNTS, {});
  const emails = Object.keys(accounts);
  if (emails.length === 0) {
    // Nothing to retire, but record that we looked so we never look again.
    writeRaw(LEGACY_MIGRATED, '1');
    return null;
  }

  const signedInAs = readRaw(LEGACY_SESSION);
  const account = signedInAs ? accounts[signedInAs] : undefined;

  let migratedName = '';
  if (account) {
    const saved = readRaw(legacyProgressKey(account.email));
    const guestKey = progressKeyFor({ kind: 'guest' });
    /* Only claim the guest slot if it is empty. Someone who used a device
       account *and* played as a guest has two histories; overwriting the one
       in front of them to restore the other would be the wrong guess. The
       account's progress stays at its own key either way, so nothing is lost —
       signing in to the cloud will merge it back. */
    if (saved && !readRaw(guestKey)) {
      writeRaw(guestKey, saved);
      migratedName = account.name;
    }
  }

  removeRaw(LEGACY_ACCOUNTS);
  removeRaw(LEGACY_SESSION);
  writeRaw(LEGACY_MIGRATED, '1');
  return migratedName ? { migratedName } : null;
}

/** Progress saved under a retired device account, for the sign-up merge. */
export function orphanedDeviceProgress(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith('act-command:progress:v2:local:')) keys.push(key);
    }
  } catch {
    /* Private mode or a locked-down browser: nothing to find. */
  }
  return keys;
}
