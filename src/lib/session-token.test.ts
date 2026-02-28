import { describe, expect, it } from 'vitest';
import { generateSessionToken, hashSessionToken } from './session-token';

describe('session token utilities', () => {
  it('generates non-empty raw tokens', () => {
    const token = generateSessionToken();
    expect(token.length).toBeGreaterThanOrEqual(64);
  });

  it('hashes tokens deterministically and never returns raw token', () => {
    const token = 'raw-session-token';

    const firstHash = hashSessionToken(token);
    const secondHash = hashSessionToken(token);

    expect(firstHash).toBe(secondHash);
    expect(firstHash).not.toBe(token);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
