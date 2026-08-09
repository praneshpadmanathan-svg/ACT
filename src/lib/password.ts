/* Is this password worth having?

   Length alone is a weak test. "password1234" is twelve characters and is
   guessed in the first thousand attempts of any attack; so are the site's own
   name, the user's email, and a run off the keyboard. The audience here is
   13-to-17-year-olds, and the realistic threat is not someone brute-forcing
   this app — it is that the password they pick here is the one guarding their
   email, and a credential-stuffing list somewhere already has it.

   Supabase's breached-password check is the real defence and it runs server
   side, but it is a dashboard setting that a deployment can be missing. This
   is the cheap client-side floor underneath it: catch the handful of shapes
   that are certain to be bad, explain why in a sentence, and get out of the
   way. It is not a strength meter — those mostly teach people to add an
   exclamation mark to the end. */

const MIN_LENGTH = 8;

/** Passwords that need no leak to guess. */
const OBVIOUS = [
  'password',
  'passw0rd',
  'letmein',
  'welcome',
  'iloveyou',
  'princess',
  'qwerty',
  'asdfgh',
  'zxcvbn',
  'abc123',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'superman',
  'trustno1',
  'sunshine',
  'starwars',
  'whatever',
  'actcommand',
  'act command',
  'command',
  'changeme',
  'secret',
];

/** Straight runs, forwards or backwards: 123456, abcdef, 987654. */
function isRun(value: string): boolean {
  if (value.length < 4) return false;
  let ascending = 0;
  let descending = 0;
  for (let i = 1; i < value.length; i++) {
    const step = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (step === 1) ascending++;
    if (step === -1) descending++;
  }
  return ascending >= value.length - 1 || descending >= value.length - 1;
}

export interface PasswordVerdict {
  ok: boolean;
  /** Shown as-is. Says what is wrong and what to do instead. */
  reason?: string;
}

export function checkPassword(password: string, email = ''): PasswordVerdict {
  const value = password.trim();

  if (value.length < MIN_LENGTH) {
    return {
      ok: false,
      reason: `Use at least ${MIN_LENGTH} characters — longer is the single thing that helps most.`,
    };
  }
  if (value.length > 72) {
    // bcrypt silently ignores everything past 72 bytes, so say so rather than
    // letting someone believe in security they do not have.
    return { ok: false, reason: 'Keep it under 72 characters.' };
  }

  const lower = value.toLowerCase();
  const stripped = lower.replace(/[^a-z0-9]/g, '');

  if (new Set(value).size <= 2) {
    return { ok: false, reason: 'That is the same character over and over — mix it up a little.' };
  }
  if (isRun(lower)) {
    return {
      ok: false,
      reason: 'That is a straight run off the keyboard. Try something less predictable.',
    };
  }
  if (OBVIOUS.some((bad) => stripped.includes(bad.replace(/[^a-z0-9]/g, '')))) {
    return {
      ok: false,
      reason: 'That is one of the first passwords anyone guesses. Please pick another.',
    };
  }

  const localPart =
    email
      .split('@')[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') ?? '';
  if (localPart.length >= 4 && stripped.includes(localPart)) {
    return { ok: false, reason: 'Your password should not contain your email address.' };
  }

  /* Only a nudge, not a rule. Composition requirements are why people end up
     with "Password1!" — but a password made of one kind of character and no
     length to compensate is genuinely weak, so that combination is refused. */
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(value)).length;
  if (classes === 1 && value.length < 12) {
    return {
      ok: false,
      reason: 'All one kind of character — add a number or a capital, or make it longer.',
    };
  }

  return { ok: true };
}
