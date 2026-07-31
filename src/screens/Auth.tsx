/* Sign in, sign up, forgot, reset — and the age gate in front of all of it.

   Accounts are Supabase now, full stop. The old on-device password path is
   gone; see the note at the top of lib/identity.ts for why it had to be.

   Nothing here is a wall. Every screen in this file has a way past it that does
   not involve giving us an email address, because the app works completely
   without one and most people should never need to. */

import { useState, type FormEvent, type ReactNode } from 'react';
import { hrefFor, useNavigate, type AuthMode } from '@/lib/router';
import { useStore } from '@/lib/store';
import {
  cloudEnabled,
  requestPasswordReset,
  sendLoginCode,
  setNewPassword,
  signIn,
  signUp,
  verifyLoginCode,
} from '@/lib/supabase';
import {
  MONTHS,
  isRealDate,
  rememberVerdict,
  rememberedVerdict,
  verdictFor,
  type DateParts,
} from '@/lib/ageGate';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { Button } from '@/components/ui';
import { burstConfetti } from '@/components/Feedback';

export function Auth({ mode: initialMode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const { continueAsGuest, claimGuestProgress, refreshAuth, authRedirect, clearAuthRedirect } =
    useStore();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<'confirm' | 'code' | 'reset' | null>(null);

  /* Asked once, at account creation only, and only if we have not already been
     told. Playing needs no age because playing collects nothing. */
  const [ageChecked, setAgeChecked] = useState(() => rememberedVerdict() !== null);
  const [tooYoung, setTooYoung] = useState(() => rememberedVerdict() === 'too-young');

  const startPlaying = () => {
    continueAsGuest();
    navigate({ name: 'onboarding' }, { replace: true });
  };

  const go = (next: AuthMode) => {
    sfx.select();
    setMode(next);
    setError(null);
    setSent(null);
  };

  /* ------------------------------------------------------------- submit */

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode !== 'reset' && !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Pick a name for your traveller.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        /* Set before the request, not after: confirmation takes the player out
           of the app entirely, and they may never come back to this component
           to have it set for them. */
        claimGuestProgress();
        const result = await signUp(name.trim(), email, password);
        if (!result.ok) return fail(result.error);
        if (result.needsConfirmation) return setSent('confirm');
        await refreshAuth();
        return succeed();
      }

      if (mode === 'signin') {
        const result = await signIn(email, password);
        if (!result.ok) return fail(result.error);
        await refreshAuth();
        return succeed();
      }

      if (mode === 'forgot') {
        const result = await requestPasswordReset(email);
        if (!result.ok) return fail(result.error);
        return setSent('reset');
      }

      if (mode === 'reset') {
        const result = await setNewPassword(password);
        if (!result.ok) return fail(result.error);
        clearAuthRedirect();
        await refreshAuth();
        return succeed();
      }
    } catch {
      fail('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const fail = (message?: string) => {
    setError(message ?? 'Something went wrong.');
    sfx.wrong();
  };

  const succeed = () => {
    sfx.achieve();
    burstConfetti(70);
    // App decides between camp and onboarding once the profile has loaded.
    navigate({ name: 'home' }, { replace: true });
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await verifyLoginCode(email, code);
      if (!result.ok) return fail(result.error);
      await refreshAuth();
      succeed();
    } catch {
      fail('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const emailACode = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter your email address first.');
      return;
    }
    setBusy(true);
    try {
      const result = await sendLoginCode(email);
      if (!result.ok) return fail(result.error);
      setSent('code');
    } catch {
      fail('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------------- render */

  // Accounts switched off for this deployment: say so rather than showing a
  // form that cannot work.
  if (!cloudEnabled) {
    return (
      <Frame title="Play on">
        <p className="mb-6 font-read text-[15px] leading-relaxed text-parchment-dim">
          This deployment has no account server configured, so everything saves to this
          browser instead. All 754 questions, every lesson and every test still work.
        </p>
        <Button variant="primary" size="lg" className="w-full" onClick={startPlaying}>
          Start the journey ▶
        </Button>
        <BackLink onClick={() => navigate({ name: 'landing' })} />
      </Frame>
    );
  }

  if (tooYoung) {
    return (
      <Frame title="Come on in">
        <p className="font-read text-[15px] leading-relaxed text-parchment-dim">
          We only make accounts for people <b className="text-parchment">13 and over</b>, so
          this one is on the house — nothing to sign up for and no email needed.
        </p>
        <p className="mt-3 font-read text-[15px] leading-relaxed text-parchment-dim">
          Everything is unlocked: all four roads, every lesson, the guardians, the timed
          trial. Your progress saves on this device, so come back to the same browser and
          your world is where you left it.
        </p>
        <Button variant="primary" size="lg" className="mt-7 w-full" onClick={startPlaying}>
          Start the journey ▶
        </Button>
        <BackLink onClick={() => navigate({ name: 'landing' })} />
      </Frame>
    );
  }

  if (mode === 'signup' && !ageChecked) {
    return (
      <AgeGate
        onAnswer={(dob) => {
          const verdict = verdictFor(dob);
          rememberVerdict(verdict);
          setAgeChecked(true);
          setTooYoung(verdict === 'too-young');
        }}
        onBack={() => navigate({ name: 'landing' })}
      />
    );
  }

  if (sent) {
    const copy = {
      confirm: {
        title: 'Check your email',
        body: (
          <>
            We sent a confirmation link to <b className="text-cliffs">{email}</b>. Open it and
            you will land back here, signed in, with your progress intact.
          </>
        ),
      },
      code: {
        title: 'Check your email',
        body: (
          <>
            We sent a sign-in code to <b className="text-cliffs">{email}</b>. Enter it below —
            or just click the link in the email.
          </>
        ),
      },
      reset: {
        title: 'Check your email',
        body: (
          <>
            If <b className="text-cliffs">{email}</b> has an account, a reset link is on its
            way. Open it and you can choose a new password.
          </>
        ),
      },
    }[sent];

    return (
      <Frame title={copy.title}>
        <p className="font-read text-[15px] leading-relaxed text-parchment-dim">{copy.body}</p>

        {sent === 'code' && (
          <form onSubmit={submitCode} className="mt-6 space-y-4">
            <Field
              label="Six-digit code"
              value={code}
              onChange={setCode}
              placeholder="000000"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={8}
            />
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </Button>
          </form>
        )}

        <Button className="mt-6 w-full" onClick={() => go('signin')}>
          Back to sign in
        </Button>
      </Frame>
    );
  }

  const title = {
    signup: 'Begin your journey',
    signin: 'Welcome back',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  }[mode];

  const subtitle = {
    signup: 'An account keeps your progress on every device you use.',
    signin: 'Your world is where you left it.',
    forgot: 'We will email you a link to set a new one.',
    reset: 'Pick something you have not used anywhere else.',
  }[mode];

  return (
    <Frame title={title} subtitle={subtitle}>
      {authRedirect && !authRedirect.ok && mode === 'reset' && (
        <ErrorNote>
          {authRedirect.error ?? 'That link has expired.'} Ask for a new one below.
        </ErrorNote>
      )}

      {(mode === 'signup' || mode === 'signin') && (
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-leather-700 bg-leather-900 p-1">
          {(['signup', 'signin'] as AuthMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => go(m)}
              className={cx(
                'rounded px-3 py-2 font-display text-[13px] font-semibold transition-colors',
                mode === m ? 'bg-leather-750 text-gold' : 'text-ink-faint hover:text-parchment',
              )}
            >
              {m === 'signup' ? 'New traveller' : 'Returning'}
            </button>
          ))}
        </div>
      )}

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

        {mode !== 'reset' && (
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
          />
        )}

        {mode !== 'forgot' && (
          <Field
            label={mode === 'reset' ? 'New password' : 'Password'}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={mode === 'signin' ? '••••••••' : 'At least 8 characters'}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy
            ? 'Working…'
            : { signup: 'Create account', signin: 'Sign in', forgot: 'Email me a link', reset: 'Save password' }[mode]}
        </Button>
      </form>

      {mode === 'signin' && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void emailACode()}
            disabled={busy}
            className="font-read text-[13.5px] text-cliffs-text underline-offset-2 transition-colors hover:underline disabled:opacity-50"
          >
            Email me a code instead
          </button>
          <button
            type="button"
            onClick={() => go('forgot')}
            className="font-read text-[13.5px] text-ink-faint transition-colors hover:text-parchment"
          >
            Forgot password?
          </button>
        </div>
      )}

      {mode === 'signup' && (
        <p className="mt-4 font-read text-[12.5px] leading-relaxed text-ink-faint">
          By creating an account you agree to our{' '}
          <a href={hrefFor({ name: 'terms' })} className="text-cliffs-text hover:underline">
            terms
          </a>{' '}
          and{' '}
          <a href={hrefFor({ name: 'privacy' })} className="text-cliffs-text hover:underline">
            privacy policy
          </a>
          . We ask for an email so your progress can follow you between devices — nothing
          else, and never for advertising.
        </p>
      )}

      {mode !== 'reset' && (
        <div className="mt-7 border-t border-leather-700 pt-6 text-center">
          <Button className="w-full" onClick={startPlaying}>
            Play without an account
          </Button>
          <p className="mt-3 font-read text-[13px] text-ink-faint">
            Everything is unlocked either way. Progress saves to this browser.
          </p>
        </div>
      )}

      <BackLink
        onClick={() => (mode === 'forgot' ? go('signin') : navigate({ name: 'landing' }))}
      />
    </Frame>
  );
}

/* ------------------------------------------------------------------ pieces */

function Frame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
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
        <h1 className="heading mb-1 text-center text-[24px] text-parchment">{title}</h1>
        {subtitle && (
          <p className="mb-6 text-center font-read text-[14px] text-ink-faint">{subtitle}</p>
        )}
        {children}
      </div>
    </div>
  );
}

/* The gate itself.

   Three separate fields rather than a free-text date, and a named month rather
   than a number: "03/04" is the 4th of March or the 3rd of April depending on
   where the student grew up, and guessing wrong could put them on the wrong
   side of the line. Nothing on this screen mentions what the threshold is. */
function AgeGate({
  onAnswer,
  onBack,
}: {
  onAnswer: (dob: DateParts) => void;
  onBack: () => void;
}) {
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const dob = { year: Number(year), month: Number(month), day: Number(day) };
    if (!month || !day || !year || !isRealDate(dob)) {
      setError('That is not a date on the calendar — check the day and year.');
      sfx.wrong();
      return;
    }
    sfx.select();
    onAnswer(dob);
  };

  const thisYear = new Date().getFullYear();

  return (
    <Frame title="When were you born?" subtitle="One question, then you are on your way.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-2.5">
          <label className="block">
            <FieldLabel>Month</FieldLabel>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-lg border border-leather-700 bg-leather-900 px-3 py-2.5 font-read text-[15px] text-parchment outline-none transition-colors focus:border-gold-deep"
            >
              <option value="">—</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <FieldLabel>Day</FieldLabel>
            <input
              value={day}
              onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="1"
              inputMode="numeric"
              className="w-full rounded-lg border border-leather-700 bg-leather-900 px-3 py-2.5 font-read text-[15px] text-parchment outline-none transition-colors placeholder:text-[#6b5c44] focus:border-gold-deep"
            />
          </label>

          <label className="block">
            <FieldLabel>Year</FieldLabel>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder={String(thisYear - 16)}
              inputMode="numeric"
              className="w-full rounded-lg border border-leather-700 bg-leather-900 px-3 py-2.5 font-read text-[15px] text-parchment outline-none transition-colors placeholder:text-[#6b5c44] focus:border-gold-deep"
            />
          </label>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button type="submit" variant="primary" size="lg" className="w-full">
          Continue
        </Button>
      </form>

      <p className="mt-4 font-read text-[12.5px] leading-relaxed text-ink-faint">
        We use this once, to work out which parts of the site we are allowed to offer you.
        Your date of birth is <b className="text-parchment-dim">not saved</b> and never
        leaves this device.
      </p>

      <BackLink onClick={onBack} />
    </Frame>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block font-script text-[12px] uppercase tracking-[0.16em] text-ink-faint">
      {children}
    </span>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-blood/50 bg-blood/10 px-3 py-2 font-read text-[13.5px] leading-snug text-[#e8a094]"
    >
      {children}
    </p>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-6 w-full font-script text-[12px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-parchment"
    >
      ← Back
    </button>
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
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="w-full rounded-lg border border-leather-700 bg-leather-900 px-3.5 py-2.5 font-read text-[15px] text-parchment outline-none transition-colors placeholder:text-[#6b5c44] focus:border-gold-deep"
      />
    </label>
  );
}
