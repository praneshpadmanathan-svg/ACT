/* Accounts stored on this device.

   Honest about what this is: a way to keep separate profiles on one browser
   and to put a name on your progress. It is NOT security. The password is
   salted and hashed with SHA-256 so it isn't sitting in localStorage in the
   clear, but anyone with access to the browser can read or clear the store.
   Never reuse a password you care about — the sign-up screen says so too.

   Real cross-device auth is the Supabase path in supabase.ts, which takes
   over automatically when the env vars are set. */

import { readJSON, removeRaw, readRaw, writeJSON, writeRaw } from './storage';

const ACCOUNTS_KEY = 'act-command:accounts';
const SESSION_KEY = 'act-command:local-session';

export interface LocalAccount {
  email: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: number;
}

type AccountStore = Record<string, LocalAccount>;

function loadAccounts(): AccountStore {
  return readJSON<AccountStore>(ACCOUNTS_KEY, {});
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time-ish compare, so a timing side channel isn't trivially free. */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface LocalAuthResult {
  ok: boolean;
  error?: string;
  account?: LocalAccount;
}

export async function localSignUp(
  name: string,
  email: string,
  password: string,
): Promise<LocalAuthResult> {
  const key = email.trim().toLowerCase();
  const accounts = loadAccounts();

  if (accounts[key]) {
    return { ok: false, error: 'An account with that email already exists on this device.' };
  }

  const salt = randomSalt();
  const account: LocalAccount = {
    email: key,
    name: name.trim(),
    salt,
    hash: await hashPassword(password, salt),
    createdAt: Date.now(),
  };

  accounts[key] = account;
  writeJSON(ACCOUNTS_KEY, accounts);
  writeRaw(SESSION_KEY, key);
  return { ok: true, account };
}

export async function localSignIn(email: string, password: string): Promise<LocalAuthResult> {
  const key = email.trim().toLowerCase();
  const account = loadAccounts()[key];

  // Same message either way, so the form can't be used to enumerate accounts.
  const rejection = { ok: false as const, error: 'That email and password do not match an account on this device.' };
  if (!account) return rejection;

  const attempt = await hashPassword(password, account.salt);
  if (!sameHash(attempt, account.hash)) return rejection;

  writeRaw(SESSION_KEY, key);
  return { ok: true, account };
}

export function localSignOut(): void {
  removeRaw(SESSION_KEY);
}

export function currentLocalAccount(): LocalAccount | null {
  const key = readRaw(SESSION_KEY);
  if (!key) return null;
  return loadAccounts()[key] ?? null;
}

export function hasLocalAccounts(): boolean {
  return Object.keys(loadAccounts()).length > 0;
}

/* --------------------------------------------------------- profile scoping */

/** Who the current progress belongs to. Progress is stored per identity so
 *  two people sharing a browser don't overwrite each other. */
export type Identity =
  | { kind: 'guest' }
  | { kind: 'local'; email: string }
  | { kind: 'cloud'; userId: string };

export function progressKeyFor(identity: Identity): string {
  switch (identity.kind) {
    case 'local':
      return `act-command:progress:v2:local:${identity.email}`;
    case 'cloud':
      return `act-command:progress:v2:cloud:${identity.userId}`;
    default:
      return 'act-command:progress:v2:guest';
  }
}
