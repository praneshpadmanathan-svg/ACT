/* Sign in / create an account.

   Two backends, picked automatically: Supabase when it's configured (real
   cross-device sync), otherwise accounts stored on this device. The screen
   says plainly which one is in play, and the local path warns not to reuse a
   password — it is profile separation, not security. */

import { useState, type FormEvent } from 'react';
import { useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { cloudEnabled, signIn, signUp } from '@/lib/supabase';
import { localSignIn, localSignUp, progressKeyFor, type Identity } from '@/lib/localAuth';
import { readRaw } from '@/lib/storage';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { Button } from '@/components/ui';
import { burstConfetti } from '@/components/Feedback';

type Mode = 'signin' | 'signup';

export function Auth({ mode: initialMode }: { mode: Mode }) {
  const navigate = useNavigate();
  const { continueAsGuest, refreshAuth, useLocalAccount, progress } = useStore();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  /* Where to land after authenticating.

     This used to read `progress.profile` from the store, which is the *previous*
     identity's progress at this moment — switching accounts loads the new one
     through a state update that has not landed yet. So signing back in to an
     established account sent it through onboarding again, as if it were new,
     and a second pass would overwrite the profile it already had.

     Reading the target account's own saved progress avoids the race entirely:
     the answer is on disk before we ever navigate. */
  const goNext = (identity?: Identity) => {
    let hasProfile = Boolean(progress.profile);
    if (identity) {
      try {
        const saved = readRaw(progressKeyFor(identity));
        hasProfile = saved ? Boolean(JSON.parse(saved)?.profile) : false;
      } catch {
        // Unreadable or corrupt: fall back to onboarding, which is recoverable.
        hasProfile = false;
      }
    }
    navigate({ name: hasProfile ? 'home' : 'onboarding' }, { replace: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Use at least 6 characters.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Pick a name for your traveller.');
      return;
    }

    setBusy(true);
    /* Set once we know which account we ended up in, so goNext can read that
       account's own saved progress rather than the store's stale copy. */
    let signedInAs: Identity | undefined;
    try {
      if (cloudEnabled) {
        const result =
          mode === 'signup' ? await signUp(name.trim(), email, password) : await signIn(email, password);
        if (!result.ok) {
          setError(result.error ?? 'Something went wrong.');
          sfx.wrong();
          return;
        }
        if (result.needsConfirmation) {
          setConfirmSent(true);
          return;
        }
        await refreshAuth();
      } else {
        const result =
          mode === 'signup'
            ? await localSignUp(name.trim(), email, password)
            : await localSignIn(email, password);
        if (!result.ok || !result.account) {
          setError(result.error ?? 'Something went wrong.');
          sfx.wrong();
          return;
        }
        useLocalAccount(result.account);
        signedInAs = { kind: 'local', email: result.account.email };
      }

      sfx.achieve();
      burstConfetti(70);
      goNext(signedInAs);
    } finally {
      setBusy(false);
    }
  };

  const startGuest = () => {
    sfx.achieve();
    continueAsGuest();
    goNext({ kind: 'guest' });
  };

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-14">
      <img
        src="/art/camp-bg.webp"
        alt=""
        className="absolute inset-0 h-full w-full select-none object-cover"
        draggable={false}
      />
      <div className="absolute inset-0 bg-leather-950/84" />

      <div className="panel-lit relative z-10 w-full max-w-md p-7 sm:p-9">
        {confirmSent ? (
          <div className="text-center">
            <h1 className="heading mb-4 text-[22px] text-gold">Check your email</h1>
            <p className="font-read text-[15px] leading-relaxed text-parchment-dim">
              We sent a confirmation link to <b className="text-cliffs">{email}</b>. Open it, then come
              back and sign in.
            </p>
            <Button
              className="mt-7 w-full"
              onClick={() => {
                setConfirmSent(false);
                setMode('signin');
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <h1 className="heading mb-1 text-center text-[24px] text-parchment">
              {mode === 'signup' ? 'Begin your journey' : 'Welcome back'}
            </h1>
            <p className="mb-6 text-center font-read text-[14px] text-ink-faint">
              {cloudEnabled
                ? 'Your progress follows you to any device.'
                : 'Your progress is kept on this device.'}
            </p>

            <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-leather-700 bg-leather-900 p-1">
              {(['signup', 'signin'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    sfx.select();
                    setMode(m);
                    setError(null);
                  }}
                  className={cx(
                    'rounded px-3 py-2 font-display text-[13px] font-semibold transition-colors',
                    mode === m ? 'bg-leather-750 text-gold' : 'text-ink-faint hover:text-parchment',
                  )}
                >
                  {m === 'signup' ? 'New traveller' : 'Returning'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <Field
                  label="Name"
                  value={name}
                  onChange={setName}
                  placeholder="What shall we call you?"
                  maxLength={24}
                  autoComplete="nickname"
                />
              )}
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />

              {error && (
                <p className="rounded-lg border border-blood/50 bg-blood/10 px-3 py-2 font-read text-[13.5px] leading-snug text-[#e8a094]">
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </Button>
            </form>

            {!cloudEnabled && mode === 'signup' && (
              <p className="mt-4 rounded-lg border border-leather-700 bg-leather-900 px-3.5 py-2.5 font-read text-[13px] leading-relaxed text-ink-faint">
                This account lives in this browser only — it separates your progress from anyone else
                using this computer. It is not secure storage, so please don't reuse an important
                password.
              </p>
            )}

            <div className="mt-7 border-t border-leather-700 pt-6 text-center">
              <Button className="w-full" onClick={startGuest}>
                Continue without an account
              </Button>
              <p className="mt-3 font-read text-[13px] text-ink-faint">
                Everything is unlocked either way.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate({ name: 'landing' })}
              className="mt-6 w-full font-script text-[12px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-parchment"
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  maxLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-script text-[12px] uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-leather-700 bg-leather-900 px-3.5 py-2.5 font-read text-[15px] text-parchment outline-none transition-colors placeholder:text-[#6b5c44] focus:border-gold-deep"
      />
    </label>
  );
}
