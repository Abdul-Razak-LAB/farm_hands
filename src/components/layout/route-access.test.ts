import { describe, expect, it } from 'vitest';
import { hasRouteAccess } from './route-access';

describe('route access guard behavior', () => {
  it('denies worker from manager-owner restricted route', () => {
    expect(hasRouteAccess('/finance', 'WORKER')).toBe(false);
  });

  it('allows manager on manager-owner route', () => {
    expect(hasRouteAccess('/finance', 'MANAGER')).toBe(true);
  });

  it('denies manager from worker lane route where not allowed', () => {
    expect(hasRouteAccess('/tasks', 'OWNER')).toBe(false);
  });

  it('allows unknown route by default', () => {
    expect(hasRouteAccess('/some-unrestricted-path', 'WORKER')).toBe(true);
  });
});
