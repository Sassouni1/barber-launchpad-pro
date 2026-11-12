import { describe, it, expect } from 'bun:test';
import { resolvePostAuthPath, shouldAutoOpenReviewerMenu, markReviewerMenuShown } from '../src/lib/metaReviewerLanding';

const reviewer = { id: 'r1', user_metadata: { meta_reviewer_ads: true } };
const member = { id: 'm1', user_metadata: { full_name: 'Member' } };

const memStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('meta reviewer landing', () => {
  it('ordinary members always land on /dashboard, even with a saved destination', () => {
    expect(resolvePostAuthPath(member)).toEqual({ path: '/dashboard' });
    expect(resolvePostAuthPath(member, { pathname: '/ads' })).toEqual({ path: '/dashboard' });
  });
  it('only the exact true flag counts', () => {
    expect(resolvePostAuthPath({ user_metadata: { meta_reviewer_ads: 'true' } }).path).toBe('/dashboard');
  });
  it('reviewer lands on /ads by default', () => {
    expect(resolvePostAuthPath(reviewer)).toEqual({ path: '/ads', state: { metaReviewerLanding: true } });
    expect(resolvePostAuthPath(reviewer, { pathname: '/login' }).path).toBe('/ads');
  });
  it('reviewer keeps an explicit protected destination', () => {
    expect(resolvePostAuthPath(reviewer, { pathname: '/marketing', search: '?x=1' })).toEqual({ path: '/marketing?x=1' });
  });
  it('reviewer never resumes the Facebook OAuth callback', () => {
    expect(resolvePostAuthPath(reviewer, { pathname: '/integrations/facebook/callback', search: '?code=abc' }).path).toBe('/ads');
  });
  it('mobile menu auto-opens once, only for the reviewer landing on /ads', () => {
    const storage = memStorage();
    const state = { metaReviewerLanding: true };
    expect(shouldAutoOpenReviewerMenu({ user: member, pathname: '/ads', state, storage })).toBe(false);
    expect(shouldAutoOpenReviewerMenu({ user: reviewer, pathname: '/ads', state: null, storage })).toBe(false);
    expect(shouldAutoOpenReviewerMenu({ user: reviewer, pathname: '/ads', state, storage })).toBe(true);
    markReviewerMenuShown(reviewer.id, storage);
    expect(shouldAutoOpenReviewerMenu({ user: reviewer, pathname: '/ads', state, storage })).toBe(false);
  });
});
