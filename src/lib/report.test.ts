import { describe, expect, it } from 'vitest';
import { sanitizeForReport } from './report';

describe('sanitizeForReport', () => {
  it('drops query strings and fragments but keeps a stack frame position', () => {
    expect(
      sanitizeForReport('at f (https://act-red.vercel.app/assets/index-Ab1.js?v=2:12:34)'),
    ).toBe('at f (https://act-red.vercel.app/assets/index-Ab1.js:12:34)');
    expect(sanitizeForReport('Failed: https://x.supabase.co/auth/v1/token?code=abc&x=1 now')).toBe(
      'Failed: https://x.supabase.co/auth/v1/token now',
    );
    expect(sanitizeForReport('at https://act-red.vercel.app/#/review/q-123')).toBe(
      'at https://act-red.vercel.app/',
    );
  });

  it('leaves plain URLs and frames alone', () => {
    const frame = 'at g (https://act-red.vercel.app/assets/index-Ab1.js:1:99)';
    expect(sanitizeForReport(frame)).toBe(frame);
  });

  it('removes email addresses and tokens', () => {
    expect(sanitizeForReport('User a.b+c@school.org not found')).toBe('User [email] not found');
    expect(sanitizeForReport('bad jwt eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl')).toBe('bad jwt [token]');
    expect(sanitizeForReport(`key ${'a'.repeat(48)} rejected`)).toBe('key [token] rejected');
  });
});
