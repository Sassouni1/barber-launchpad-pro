// Shared, safe URL normalization for business card / wallet links.
export const CARD_BASE_URL = "https://member.thebarberlaunch.com";

const UNSAFE_SCHEME = /^(javascript|data|vbscript|file|blob):/i;

export function normalizeWebsiteUrl(input?: string | null): string | null {
  if (!input) return null;
  const raw = String(input).trim().replace(/\s+/g, "");
  if (!raw || UNSAFE_SCHEME.test(raw)) return null;
  const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  if (hasProtocol && !/^https?:\/\//i.test(raw)) return null;
  const candidate = hasProtocol ? raw : `https://${raw.replace(/^\/+/, "")}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || !/^[a-z0-9.-]+$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeInstagramHandle(input?: string | null): string | null {
  if (!input) return null;
  let raw = String(input).trim();
  if (!raw || UNSAFE_SCHEME.test(raw)) return null;
  raw = raw.replace(/^@+/, "");
  raw = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  raw = raw.replace(/^(www\.)?instagram\.com\//i, "");
  raw = raw.replace(/^(www\.)?instagr\.am\//i, "");
  raw = raw.split(/[?#]/)[0].split("/").filter(Boolean)[0] || "";
  raw = raw.replace(/^@+/, "").trim();
  if (!raw || !/^[A-Za-z0-9._]{1,30}$/.test(raw)) return null;
  return raw;
}

export function normalizeInstagramUrl(input?: string | null): string | null {
  const handle = normalizeInstagramHandle(input);
  return handle ? `https://www.instagram.com/${handle}` : null;
}
