const STATE_KEY = "ghl_oauth_state";
const RETURN_KEY = "ghl_oauth_return";
const MAX_AGE_MS = 15 * 60 * 1000;

export const GHL_CALLBACK_PATH = "/integrations/crm/callback";

type StoredState = { state: string; createdAt: number };

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Creates a CSRF state value and persists it for the return trip. */
export function createGhlOAuthState(returnPath: string) {
  const state = randomState();
  const payload: StoredState = { state, createdAt: Date.now() };
  try {
    // localStorage so a full top-level redirect (Safari) survives the round trip.
    localStorage.setItem(STATE_KEY, JSON.stringify(payload));
    localStorage.setItem(RETURN_KEY, returnPath);
  } catch {
    // Storage unavailable — the callback will report a state mismatch.
  }
  return state;
}

export function consumeGhlOAuthState(): { state: string | null; returnPath: string } {
  let stored: StoredState | null = null;
  let returnPath = "/admin";
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) stored = JSON.parse(raw) as StoredState;
    returnPath = localStorage.getItem(RETURN_KEY) || "/admin";
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(RETURN_KEY);
  } catch {
    // ignore
  }

  if (!stored || Date.now() - stored.createdAt > MAX_AGE_MS) {
    return { state: null, returnPath };
  }
  return { state: stored.state, returnPath };
}

/** Non-destructive peek, used by the popup opener before exchanging. */
export function peekGhlOAuthState(): string | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredState;
    if (Date.now() - stored.createdAt > MAX_AGE_MS) return null;
    return stored.state;
  } catch {
    return null;
  }
}

export function clearGhlOAuthState() {
  try {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(RETURN_KEY);
  } catch {
    // ignore
  }
}
