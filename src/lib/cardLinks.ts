/**
 * Shared, safe URL normalization for business card links.
 * Used at both save time and render time so existing stored values are repaired.
 */

const UNSAFE_SCHEME = /^(javascript|data|vbscript|file|blob):/i;

/**
 * Normalize a website value into a safe absolute external https/http URL.
 * Returns null for empty or unsafe input (so no broken CTA is rendered).
 */
export function normalizeWebsiteUrl(input?: string | null): string | null {
  if (!input) return null;
  const raw = String(input).trim().replace(/\s+/g, '');
  if (!raw) return null;
  if (UNSAFE_SCHEME.test(raw)) return null;

  const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  if (hasProtocol && !/^https?:\/\//i.test(raw)) return null;

  const candidate = hasProtocol ? raw : `https://${raw.replace(/^\/+/, '')}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname || !/^[a-z0-9.-]+$/i.test(url.hostname)) return null;
  return url.toString().replace(/\/$/, url.pathname === '/' && !url.search && !url.hash ? '' : '/');
}

/**
 * Extract the canonical Instagram handle from a full URL, @name, or plain name.
 */
export function normalizeInstagramHandle(input?: string | null): string | null {
  if (!input) return null;
  let raw = String(input).trim();
  if (!raw) return null;
  if (UNSAFE_SCHEME.test(raw)) return null;

  raw = raw.replace(/^@+/, '');
  // Strip any protocol + instagram domain prefix.
  raw = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  raw = raw.replace(/^(www\.)?instagram\.com\//i, '');
  raw = raw.replace(/^(www\.)?instagr\.am\//i, '');
  // Take the first path segment only, drop query/hash.
  raw = raw.split(/[?#]/)[0].split('/').filter(Boolean)[0] || '';
  raw = raw.replace(/^@+/, '').trim();
  if (!raw) return null;
  if (!/^[A-Za-z0-9._]{1,30}$/.test(raw)) return null;
  return raw;
}

/**
 * Canonical external Instagram profile URL, or null when input is unusable.
 */
export function normalizeInstagramUrl(input?: string | null): string | null {
  const handle = normalizeInstagramHandle(input);
  return handle ? `https://www.instagram.com/${handle}` : null;
}
