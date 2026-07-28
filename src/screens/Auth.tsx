/* Sign in / sign up.

   Reads clearly about what it can and cannot do: when Supabase is not
   configured the cloud fields are hidden entirely and guest mode is offered
   as the real path, rather than showing a form that silently fails. */

import { useState, type FormEvent } from 'react';
import { useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { cloudEnabled, signIn, signUp } from '@/lib/supabase';
import { sfx } from '@/lib/sfx';
import { PixelScene } from '@/game/scene';
import { Button } from '@/components/ui';
import { burstConfetti } from '@/components/Feedback';

type Mode = 'signin' | 'signup';

export function Auth({ mode: initialMode }: { mode: Mode }) {
  const navigate = useNavigate();
  const { continueAsGuest, refreshAuth, progress } = useStore();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const goNext = () => navigate({ name: progress.profile ? 'home' : 'onboarding' }, { replace: true });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Pick a name to go on the leaderboard.');
      return;
    }

    setBusy(true);
    const result =
      mode === 'signup' ? await signUp(name.trim(), email, password) : await signIn(email, password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Something went wrong.');
      sfx.wrong();
      return;
    }
    if (result.needsConfirmation) {
      setConfirmSent(true);
      return;
    }

    sfx.achieve();
    burstConfetti(70);
    await refreshAuth();
    goNext();
  };

  const startGuest = () => {
    sfx.achieve();
    continueAsGuest();
    goNext();
  };

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-14 crt vignette">
      <PixelScene seed={13} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-ink-950/70" />

      <div className="pixel-panel relative z-10 w-full max-w-md p-7 sm:p-9">
        {confirmSent ? (
          <div className="text-center">
            <h1 className="heading-pixel mb-5 text-[15px] text-gold">Check your email</h1>
            <p className="text-[15px] leading-relaxed text-[#a89ac6]">
              We sent a confirmation link to{' '}
              <b className="text-cyan">{email}</b>. Open it, then come back and sign in.
            </p>
            <Button
              variant="ghost"
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
            <h1 className="heading-pixel mb-6 text-center text-[15px] text-white">
              {mode === 'signup' ? 'Join the climb' : 'Welcome back'}
            </h1>

            {cloudEnabled ? (
              <>
                <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border-2 border-edge bg-ink-900 p-1">
                  {(['signup', 'signin'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        sfx.select();
                        setMode(m);
                        setError(null);
                      }}
                      className={`rounded px-3 py-2 font-screen text-[11px] uppercase tracking-wide transition-colors ${
                        mode === m ? 'bg-ink-700 text-gold' : 'text-[#8f86b5] hover:text-white'
                      }`}
                    >
                      {m === 'signup' ? 'New player' : 'Returning'}
                    </button>
                  ))}
                </div>

                <form onSubmit={submit} className="space-y-4">
                  {mode === 'signup' && (
                    <Field
                      label="Name"
                      value={name}
                      onChange={setName}
                      placeholder="What should we call you?"
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
                    <p className="rounded-lg border-2 border-crimson/40 bg-crimson/10 px-3 py-2 text-[13px] leading-snug text-[#ffa3b5]">
                      {error}
                    </p>
                  )}

                  <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
                    {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
                  </Button>
                </form>

                <p className="mt-5 text-center text-[13px] leading-relaxed text-[#7a6a9e]">
                  An account syncs your progress across devices.
                </p>
              </>
            ) : (
              <p className="mb-6 rounded-lg border-2 border-edge bg-ink-900 px-4 py-3 text-[14px] leading-relaxed text-[#a89ac6]">
                Accounts are not configured for this deployment, so progress saves to this device only.
                See the README to switch on cloud sync.
              </p>
            )}

            <div className="mt-7 border-t-2 border-edge pt-6 text-center">
              <Button variant="ghost" className="w-full" onClick={startGuest}>
                Continue as guest
              </Button>
              <p className="mt-3 text-[13px] text-[#7a6a9e]">
                Everything is unlocked. Progress stays in this browser.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate({ name: 'landing' })}
              className="mt-6 w-full font-screen text-[11px] uppercase tracking-wide text-[#6f6496] transition-colors hover:text-white"
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
      <span className="mb-1.5 block font-screen text-[10px] uppercase tracking-[0.14em] text-[#8f86b5]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className="w-full rounded-lg border-2 border-edge bg-ink-900 px-3.5 py-2.5 text-[15px] text-white outline-none transition-colors placeholder:text-[#5f5680] focus:border-gold"
      />
    </label>
  );
}
