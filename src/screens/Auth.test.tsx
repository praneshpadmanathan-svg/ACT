import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it, vi } from 'vitest';

const signUp = vi.fn(async () => ({ ok: true }));

vi.mock('@/lib/supabase', () => ({
  cloudEnabled: true,
  signUp,
  signIn: vi.fn(),
  sendLoginCode: vi.fn(),
  verifyLoginCode: vi.fn(),
  requestPasswordReset: vi.fn(),
  setNewPassword: vi.fn(),
}));
vi.mock('@/lib/store', () => ({
  useStore: () => ({
    userId: null,
    playerName: 'Traveller',
    hasStarted: false,
    progress: {},
    signOut: vi.fn(),
    continueAsGuest: vi.fn(),
    claimGuestProgress: vi.fn(),
    releaseGuestClaim: vi.fn(),
    refreshAuth: vi.fn(),
    authRedirect: null,
    clearAuthRedirect: vi.fn(),
  }),
}));
vi.mock('@/lib/sfx', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('@/components/Art', () => ({ Art: () => <span /> }));
vi.mock('@/components/Feedback', () => ({ burstConfetti: vi.fn() }));

const { Auth } = await import('./Auth');

beforeEach(() => {
  signUp.mockClear();
  localStorage.clear();
  // Past the age gate: a pass is remembered for the session, not the browser.
  sessionStorage.setItem('act-command:age-verdict', 'eligible');
});

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

it('will not create an account until the terms box is ticked, and it starts unticked', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<Auth mode="signup" />));

  const box = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
  expect(box).not.toBeNull();
  expect(box!.checked).toBe(false);
  expect(box!.closest('label')!.querySelector('a[href*="privacy"]')).not.toBeNull();

  const inputs = host.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"])');
  act(() => {
    type(inputs[0]!, 'Sam');
    type(inputs[1]!, 'sam@example.com');
    type(inputs[2]!, 'a much longer passphrase 42');
  });

  const form = host.querySelector('form')!;
  await act(async () => form.requestSubmit());
  expect(signUp).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Tick the box');

  act(() => box!.click());
  expect(box!.checked).toBe(true);
  await act(async () => form.requestSubmit());
  expect(signUp).toHaveBeenCalledTimes(1);

  act(() => root.unmount());
  host.remove();
});
