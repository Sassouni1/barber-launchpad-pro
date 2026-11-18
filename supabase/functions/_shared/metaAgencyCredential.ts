// Server-only lifecycle for Barber Launch's agency Meta token (business 1832826473434326,
// ad account 2895514127400266). Token values never leave this module's callers: they are not
// logged, returned, or stored in plain text. Status written for admins is sanitized.
import { BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID, META_GRAPH_BASE, normalizeAgencyToken, AGENCY_TOKEN_ENV } from './metaAgency.ts';
import { BARBER_LAUNCH_BUSINESS_ID } from './pageAdAccess.ts';

export const RENEW_BEFORE_DAYS = 14;
export const ALERT_BEFORE_DAYS = 21;
export const REQUIRED_SCOPES = ['business_management', 'ads_read'] as const;
const DAY = 86_400_000;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type Inspection =
  | { ok: true; appId: string; scopes: string[]; expiresAt: Date | null; dataAccessExpiresAt: Date | null }
  | { ok: false; kind: 'missing' | 'expired' | 'revoked' | 'invalid' | 'unreachable'; code: number | null; message: string };

type Failure = Extract<Inspection, { ok: false }>;
const fail = (kind: Failure['kind'], code: number | null, message: string): Failure => ({ ok: false, kind, code, message });

async function getJson(fetchImpl: FetchLike, url: URL, headers?: Record<string, string>) {
  try {
    const res = await fetchImpl(url, headers ? { headers } : undefined);
    const body = await res.json().catch(() => null) as Record<string, unknown> | null;
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  }
}

const errOf = (body: Record<string, unknown> | null) => {
  const e = body?.error as { code?: unknown; error_subcode?: unknown } | undefined;
  return { code: typeof e?.code === 'number' ? e.code : null, sub: typeof e?.error_subcode === 'number' ? e.error_subcode : null };
};

function classify(code: number | null, sub: number | null): Exclude<Inspection, { ok: true }>['kind'] {
  if (code === 190 && sub === 463) return 'expired';
  if (code === 190 || code === 102) return sub === 463 ? 'expired' : 'revoked';
  if (code === null) return 'unreachable';
  return 'invalid';
}

const toDate = (v: unknown) => (typeof v === 'number' && v > 0 ? new Date(v * 1000) : null);

/** debug_token with the app token, then ability reads scoped to the configured business and ad account. */
export async function verifyAgencyToken(
  fetchImpl: FetchLike, raw: string | null | undefined, appId: string, appSecret: string, now: Date, base = META_GRAPH_BASE,
): Promise<Inspection> {
  const token = normalizeAgencyToken(raw);
  if (!token) return fail('missing', null, 'No agency token is configured.');
  const dbg = new URL(`${base}/debug_token`);
  dbg.searchParams.set('input_token', token);
  const d = await getJson(fetchImpl, dbg, { Authorization: `Bearer ${appId}|${appSecret}` });
  if (d.status === 0 || !d.body) return fail('unreachable', null, 'Could not reach Meta to check the agency token.');
  if (d.body.error) {
    const { code, sub } = errOf(d.body);
    return fail(code === 190 ? 'invalid' : classify(code, sub), code, 'Meta refused the token check (app credentials may be wrong).');
  }
  const data = (d.body.data ?? {}) as Record<string, unknown>;
  const expiresAt = toDate(data.expires_at);
  if (data.is_valid !== true) {
    const { code, sub } = errOf({ error: data.error });
    if (expiresAt && expiresAt <= now) return fail('expired', code ?? 190, 'The agency token has expired.');
    const kind = classify(code ?? 190, sub);
    return fail(kind, code ?? 190, kind === 'expired' ? 'The agency token has expired.' : 'The agency token was revoked or is no longer valid.');
  }
  if (expiresAt && expiresAt <= now) return fail('expired', 190, 'The agency token has expired.');
  if (String(data.app_id ?? '') !== appId) return fail('invalid', null, 'The agency token belongs to a different Meta app.');
  const scopes = Array.isArray(data.scopes) ? data.scopes.filter((s): s is string => typeof s === 'string') : [];
  const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
  if (missing.length) return fail('invalid', null, `The agency token is missing permissions: ${missing.join(', ')}.`);
  const dataAccessExpiresAt = toDate(data.data_access_expires_at);
  if (dataAccessExpiresAt && dataAccessExpiresAt <= now) {
    return fail('expired', null, `Meta data access for this token ended on ${dataAccessExpiresAt.toISOString()}; Meta will not return business or ad account data until the app is re-authorized.`);
  }

  const auth = { Authorization: `Bearer ${token}` };
  const acct = new URL(`${base}/act_${BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID}`);
  acct.searchParams.set('fields', 'account_id');
  const a = await getJson(fetchImpl, acct, auth);
  if (a.status === 0) return fail('unreachable', null, 'Could not reach Meta to check the agency ad account.');
  if (a.body?.error || String(a.body?.account_id ?? '') !== BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID) {
    const { code, sub } = errOf(a.body);
    return fail(code === 190 ? classify(code, sub) : 'invalid', code, 'The agency token cannot read the Barber Launch Official ad account.');
  }
  const cp = new URL(`${base}/${BARBER_LAUNCH_BUSINESS_ID}/client_pages`);
  cp.searchParams.set('fields', 'id');
  cp.searchParams.set('limit', '1');
  const c = await getJson(fetchImpl, cp, auth);
  if (c.status === 0) return fail('unreachable', null, 'Could not reach Meta to check the business Page list.');
  if (c.body?.error || !Array.isArray(c.body?.data)) {
    const { code, sub } = errOf(c.body);
    return fail(code === 190 ? classify(code, sub) : 'invalid', code, 'The agency token cannot read the business client Page list.');
  }
  return { ok: true, appId, scopes, expiresAt, dataAccessExpiresAt };
}

/** Meta's documented long-lived exchange. Returns only the new token string or null. */
export async function exchangeAgencyToken(fetchImpl: FetchLike, raw: string, appId: string, appSecret: string, base = META_GRAPH_BASE) {
  const url = new URL(`${base}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', normalizeAgencyToken(raw) ?? '');
  const r = await getJson(fetchImpl, url);
  const token = typeof r.body?.access_token === 'string' ? r.body.access_token : null;
  return token ? { ok: true as const, token } : { ok: false as const, code: errOf(r.body).code };
}

const later = (a: Date | null, b: Date | null) => (a === null ? true : b === null ? false : a > b);
/** a lasts at least as long as b (null = no expiry reported). */
const atLeast = (a: Date | null, b: Date | null) => a === null || (b !== null && a >= b);
/** Strictly later known data-access deadline. */
const laterKnown = (a: Date | null, b: Date | null) => a !== null && b !== null && a > b;

export type StatusPatch = {
  state: 'healthy' | 'expiring' | 'renewal_failed' | 'expired' | 'revoked' | 'missing' | 'invalid' | 'check_failed';
  token_source: 'stored' | 'secret' | null;
  renewable?: boolean | null;
  expires_at: string | null;
  data_access_expires_at: string | null;
  scopes: string[];
  last_checked_at: string;
  last_healthy_at?: string;
  last_renewal_attempt_at?: string;
  last_renewed_at?: string;
  last_error_code: number | null;
  last_error_message: string | null;
  action_required: string | null;
};

export type HealthDeps = {
  fetch: FetchLike;
  now: () => Date;
  appId: string | undefined;
  appSecret: string | undefined;
  envToken: string | undefined;
  loadActive: () => Promise<{ token: string } | null>;
  store: (token: string, source: 'manual_secret' | 'exchange', info: Extract<Inspection, { ok: true }>) => Promise<void>;
  saveStatus: (patch: StatusPatch) => Promise<void>;
};

// The configured credential is Chris's own USER token for The Barber Launch app, not a system-user token.
export const ROTATE_ACTION =
  'Chris: in Meta Graph API Explorer choose The Barber Launch app (2148309075723966), generate a new User Token signed in as yourself with business_management, ads_read, ads_management and pages_show_list, then replace META_ADS_ACCESS_TOKEN in Project Settings → Secrets and press Check now. Re-authorizing starts a new Meta data-access window (about 90 days); this must be repeated before each window ends — renewal is not automatic or permanent.';

/** Marks a healthy status as expiring when the token or its Meta data-access window ends within the alert window. */
function withExpiryWarning(patch: StatusPatch, info: Extract<Inspection, { ok: true }>, now: Date): StatusPatch {
  const within = (d: Date | null) => !!d && d.getTime() - now.getTime() <= ALERT_BEFORE_DAYS * DAY;
  const notes: string[] = [];
  if (within(info.expiresAt)) notes.push(`The agency token expires on ${info.expiresAt!.toISOString()}.`);
  if (within(info.dataAccessExpiresAt)) notes.push(`Meta data access for this token ends on ${info.dataAccessExpiresAt!.toISOString()}.`);
  if (!notes.length) return patch;
  const action = `${notes.join(' ')} ${ROTATE_ACTION}`;
  return patch.state === 'healthy' ? { ...patch, state: 'expiring', action_required: action } : { ...patch, action_required: action };
}

/** One health/renewal pass. Never deactivates a working token; a failed renewal keeps the current one. */
export async function runAgencyHealthCheck(deps: HealthDeps): Promise<StatusPatch> {
  const now = deps.now();
  const checkedAt = now.toISOString();
  const base = { last_checked_at: checkedAt, scopes: [] as string[], expires_at: null, data_access_expires_at: null };
  if (!deps.appId || !deps.appSecret) {
    const patch: StatusPatch = { ...base, state: 'check_failed', token_source: null, last_error_code: null,
      last_error_message: 'The Meta app credentials are not configured on the server.', action_required: 'Configure FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in Project Settings → Secrets.' };
    await deps.saveStatus(patch);
    return patch;
  }
  const active = await deps.loadActive().catch(() => null);
  const envNorm = normalizeAgencyToken(deps.envToken);
  const storedResult = active ? await verifyAgencyToken(deps.fetch, active.token, deps.appId, deps.appSecret, now) : null;
  const envSame = !!active && normalizeAgencyToken(active.token) === envNorm;
  const envResult = envNorm && !envSame ? await verifyAgencyToken(deps.fetch, envNorm, deps.appId, deps.appSecret, now) : null;

  let current: { token: string; info: Extract<Inspection, { ok: true }>; source: 'stored' | 'secret' } | null = null;
  if (storedResult?.ok && active) current = { token: active.token, info: storedResult, source: 'stored' };
  if (envResult?.ok && envNorm && (!current || later(envResult.expiresAt, current.info.expiresAt))) {
    // A newly rotated secret is promoted into encrypted storage only after full verification.
    await deps.store(envNorm, 'manual_secret', envResult);
    current = { token: envNorm, info: envResult, source: 'stored' };
  }
  let reauthorizedAt: string | undefined;
  if (envResult?.ok && envNorm && current && current.token !== envNorm
    && laterKnown(envResult.dataAccessExpiresAt, current.info.dataAccessExpiresAt)) {
    // A fresh re-authorization (later data-access window) with a shorter-lived token: exchange it first and
    // replace the working token only if the verified replacement lasts at least as long.
    const ex = await exchangeAgencyToken(deps.fetch, envNorm, deps.appId, deps.appSecret);
    const next = ex.ok ? await verifyAgencyToken(deps.fetch, ex.token, deps.appId, deps.appSecret, now) : null;
    if (ex.ok && next?.ok && atLeast(next.expiresAt, current.info.expiresAt)
      && laterKnown(next.dataAccessExpiresAt, current.info.dataAccessExpiresAt)) {
      await deps.store(ex.token, 'exchange', next);
      current = { token: ex.token, info: next, source: 'stored' };
      reauthorizedAt = checkedAt;
    }
  }

  if (!current) {
    const failures = [storedResult, envResult, !active && !envNorm ? fail('missing', null, 'No agency token is configured.') : null].filter((r): r is Exclude<Inspection, { ok: true }> => !!r && !r.ok);
    const order = ['revoked', 'expired', 'invalid', 'missing', 'unreachable'] as const;
    const worst: Failure = order.map((k) => failures.find((f) => f.kind === k)).find((f): f is Failure => !!f) ?? fail('missing', null, 'No agency token is configured.');
    const patch: StatusPatch = { ...base, state: worst.kind === 'unreachable' ? 'check_failed' : worst.kind, token_source: active ? 'stored' : envNorm ? 'secret' : null,
      last_error_code: worst.code, last_error_message: worst.message,
      action_required: worst.kind === 'unreachable' ? 'Meta could not be reached; the check will retry automatically.' : ROTATE_ACTION };
    await deps.saveStatus(patch);
    return patch;
  }

  const info = current.info;
  const msLeft = info.expiresAt ? info.expiresAt.getTime() - now.getTime() : Infinity;
  const ok: StatusPatch = { ...base, state: 'healthy', token_source: current.source, scopes: info.scopes,
    expires_at: info.expiresAt?.toISOString() ?? null, data_access_expires_at: info.dataAccessExpiresAt?.toISOString() ?? null,
    last_healthy_at: checkedAt, last_error_code: null, last_error_message: null, action_required: null,
    ...(reauthorizedAt ? { renewable: true, last_renewal_attempt_at: reauthorizedAt, last_renewed_at: reauthorizedAt } : {}) };

  if (msLeft <= RENEW_BEFORE_DAYS * DAY) {
    ok.last_renewal_attempt_at = checkedAt;
    const ex = await exchangeAgencyToken(deps.fetch, current.token, deps.appId, deps.appSecret);
    const next = ex.ok ? await verifyAgencyToken(deps.fetch, ex.token, deps.appId, deps.appSecret, now) : null;
    if (ex.ok && next?.ok && later(next.expiresAt, info.expiresAt)) {
      await deps.store(ex.token, 'exchange', next);
      const patch = withExpiryWarning({ ...ok, renewable: true, last_renewed_at: checkedAt, scopes: next.scopes,
        expires_at: next.expiresAt?.toISOString() ?? null, data_access_expires_at: next.dataAccessExpiresAt?.toISOString() ?? null }, next, now);
      await deps.saveStatus(patch);
      return patch;
    }
    const patch: StatusPatch = withExpiryWarning({ ...ok, state: 'renewal_failed', renewable: false,
      last_error_code: ex.ok ? (next && !next.ok ? next.code : null) : ex.code,
      last_error_message: ex.ok ? 'Meta issued a replacement that did not pass verification or did not extend expiry; the current token was kept.' : 'Meta refused to renew the agency token; the current token was kept.',
      action_required: ROTATE_ACTION }, info, now);
    await deps.saveStatus(patch);
    return patch;
  }
  const final = withExpiryWarning(ok, info, now);
  await deps.saveStatus(final);
  return final;
}

type DbLike = {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

/** The single token reader for all agency Meta calls: the active verified stored token, else the secret. */
export async function getAgencyToken(db: DbLike, env: (k: string) => string | undefined = (k) => Deno.env.get(k)): Promise<string | undefined> {
  const envToken = env(AGENCY_TOKEN_ENV);
  const key = env('GHL_ENCRYPTION_KEY');
  if (!key) return envToken;
  try {
    const { data: row } = await db.from('meta_agency_credentials').select('secret_id,expires_at').eq('is_active', true).maybeSingle();
    if (!row?.secret_id) return envToken;
    if (row.expires_at && new Date(row.expires_at) <= new Date()) return envToken;
    const { data: token, error } = await db.rpc('decrypt_token', { token_id: row.secret_id, encryption_key: key });
    return !error && typeof token === 'string' && token ? token : envToken;
  } catch {
    return envToken;
  }
}

export async function loadActiveAgencyToken(db: DbLike, key: string): Promise<{ token: string } | null> {
  const { data: row } = await db.from('meta_agency_credentials').select('secret_id').eq('is_active', true).maybeSingle();
  if (!row?.secret_id) return null;
  const { data: token, error } = await db.rpc('decrypt_token', { token_id: row.secret_id, encryption_key: key });
  return !error && typeof token === 'string' && token ? { token } : null;
}
