import type { User } from '@supabase/supabase-js';

/**
 * Navigation-only helpers for the dedicated Meta app-review account.
 * The flag only changes where that account lands and which menu item is
 * emphasized; it never grants access or bypasses any permission check.
 */

export const ORDINARY_POST_AUTH_PATH = '/dashboard';
export const META_REVIEWER_PATH = '/ads';
const FACEBOOK_CALLBACK_PATH = '/integrations/facebook/callback';
const AUTH_ENTRY_PATHS = ['/', '/login', '/signin', '/create', '/auth', '/reset-password'];
const MENU_SHOWN_KEY_PREFIX = 'meta-reviewer-ads-menu-shown:';

export type MetaReviewerLandingState = { metaReviewerLanding?: boolean };

type FromLocation = { pathname?: unknown; search?: unknown; hash?: unknown } | null | undefined;

export function isMetaReviewer(user: Pick<User, 'user_metadata'> | null | undefined): boolean {
  return user?.user_metadata?.meta_reviewer_ads === true;
}

function preservedDestination(from: FromLocation): string | null {
  if (!from || typeof from.pathname !== 'string' || !from.pathname.startsWith('/')) return null;
  const pathname = from.pathname;
  if (pathname.startsWith('//')) return null;
  if (AUTH_ENTRY_PATHS.some((p) => pathname === p || (p !== '/' && pathname.startsWith(p + '/')))) return null;
  // Never resume a one-time Facebook OAuth callback URL after sign-in.
  if (pathname === FACEBOOK_CALLBACK_PATH || pathname.startsWith(FACEBOOK_CALLBACK_PATH + '/')) return null;
  const search = typeof from.search === 'string' ? from.search : '';
  const hash = typeof from.hash === 'string' ? from.hash : '';
  return `${pathname}${search}${hash}`;
}

/**
 * Where the login/create pages send a signed-in user.
 * Ordinary members always go to /dashboard (unchanged behavior).
 * The Meta reviewer goes to the protected page they were sent away from,
 * or to /ads when there was none.
 */
export function resolvePostAuthPath(
  user: Pick<User, 'user_metadata'> | null | undefined,
  from?: FromLocation,
): { path: string; state?: MetaReviewerLandingState } {
  if (!isMetaReviewer(user)) return { path: ORDINARY_POST_AUTH_PATH };
  const path = preservedDestination(from) ?? META_REVIEWER_PATH;
  const lands = path === META_REVIEWER_PATH || path.startsWith(META_REVIEWER_PATH + '?') || path.startsWith(META_REVIEWER_PATH + '#');
  return lands ? { path, state: { metaReviewerLanding: true } } : { path };
}

/** True once per browser tab session, the first time the reviewer lands on /ads after sign-in. */
export function shouldAutoOpenReviewerMenu(params: {
  user: Pick<User, 'id' | 'user_metadata'> | null | undefined;
  pathname: string;
  state: unknown;
  storage: Pick<Storage, 'getItem'> | null;
}): boolean {
  const { user, pathname, state, storage } = params;
  if (!user || !isMetaReviewer(user)) return false;
  if (pathname !== META_REVIEWER_PATH) return false;
  if (!(state as MetaReviewerLandingState | null)?.metaReviewerLanding) return false;
  try {
    return storage?.getItem(MENU_SHOWN_KEY_PREFIX + user.id) !== '1';
  } catch {
    return true;
  }
}

export function markReviewerMenuShown(userId: string, storage: Pick<Storage, 'setItem'> | null) {
  try {
    storage?.setItem(MENU_SHOWN_KEY_PREFIX + userId, '1');
  } catch {
    // Storage may be unavailable (private mode); opening once per landing is still fine.
  }
}
