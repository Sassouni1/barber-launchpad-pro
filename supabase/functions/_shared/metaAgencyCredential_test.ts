import { assertEquals, assert } from 'jsr:@std/assert@1';
import { runAgencyHealthCheck, verifyAgencyToken, getAgencyToken, ROTATE_ACTION, type StatusPatch } from './metaAgencyCredential.ts';

const NOW = new Date('2026-11-18T00:00:00Z');
const sec = (d: Date) => Math.floor(d.getTime() / 1000);
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
type Tok = { valid: boolean; app?: string; exp: Date | null; da?: Date; scopes?: string[]; sub?: number; account?: boolean; pages?: boolean };

function meta(tokens: Record<string, Tok>, exchange: Record<string, string | null> = {}) {
  const calls: string[] = [];
  const f = async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization?.replace('Bearer ', '') ?? '';
    calls.push(url.pathname);
    const body = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });
    if (url.pathname.endsWith('/debug_token')) {
      const t = tokens[url.searchParams.get('input_token')!];
      if (!t) return body({ data: { is_valid: false, error: { code: 190, subcode: 460 } } });
      return body({ data: { is_valid: t.valid, app_id: t.app ?? 'APP', scopes: t.scopes ?? ['business_management', 'ads_read', 'ads_management'],
        expires_at: t.exp ? sec(t.exp) : 0, data_access_expires_at: t.da ? sec(t.da) : undefined, error: t.valid ? undefined : { code: 190, error_subcode: t.sub ?? 463 } } });
    }
    if (url.pathname.endsWith('/oauth/access_token')) {
      const next = exchange[url.searchParams.get('fb_exchange_token')!];
      return next ? body({ access_token: next }) : body({ error: { code: 190 } }, 400);
    }
    const t = tokens[auth];
    if (url.pathname.endsWith('/act_2895514127400266')) {
      return t?.account === false ? body({ error: { code: 200 } }, 403) : body({ account_id: '2895514127400266' });
    }
    if (url.pathname.endsWith('/1832826473434326/client_pages')) {
      return t?.pages === false ? body({ error: { code: 200 } }, 403) : body({ data: [] });
    }
    return body({ error: { code: 1 } }, 500);
  };
  return { f, calls };
}

function deps(m: ReturnType<typeof meta>, env: string | undefined, active: string | null) {
  const stored: Array<{ token: string; source: string }> = [];
  const statuses: StatusPatch[] = [];
  return {
    stored, statuses,
    d: { fetch: m.f, now: () => NOW, appId: 'APP', appSecret: 'SECRET', envToken: env,
      loadActive: async () => (active ? { token: active } : null),
      store: async (token: string, source: 'manual_secret' | 'exchange') => { stored.push({ token, source }); },
      saveStatus: async (p: StatusPatch) => { statuses.push(p); } },
  };
}

Deno.test('expired secret with no stored token → expired alert, manual rotation, nothing stored', async () => {
  const m = meta({ OLD: { valid: false, exp: days(-1) } });
  const { d, stored, statuses } = deps(m, 'OLD', null);
  const r = await runAgencyHealthCheck(d);
  assertEquals(r.state, 'expired');
  assertEquals(r.last_error_code, 190);
  assert(r.action_required?.includes('Project Settings'));
  assertEquals(stored.length, 0);
  assertEquals(statuses.length, 1);
});

Deno.test('missing token → missing state', async () => {
  const { d } = deps(meta({}), undefined, null);
  assertEquals((await runAgencyHealthCheck(d)).state, 'missing');
});

Deno.test('revoked token (190/460) is reported as revoked', async () => {
  const { d } = deps(meta({ T: { valid: false, exp: days(30), sub: 460 } }), 'T', null);
  assertEquals((await runAgencyHealthCheck(d)).state, 'revoked');
});

Deno.test('a newly rotated valid secret is verified then promoted into encrypted storage', async () => {
  const m = meta({ NEW: { valid: true, exp: days(60) } });
  const { d, stored } = deps(m, 'NEW', null);
  const r = await runAgencyHealthCheck(d);
  assertEquals(r.state, 'healthy');
  assertEquals(stored, [{ token: 'NEW', source: 'manual_secret' }]);
});

Deno.test('token from a different app is never promoted', async () => {
  const { d, stored } = deps(meta({ X: { valid: true, exp: days(60), app: 'OTHER' } }), 'X', null);
  assertEquals((await runAgencyHealthCheck(d)).state, 'invalid');
  assertEquals(stored.length, 0);
});

Deno.test('token missing business_management or unable to read the ad account / client_pages is not promoted', async () => {
  for (const t of [{ valid: true, exp: days(60), scopes: ['ads_read'] }, { valid: true, exp: days(60), account: false }, { valid: true, exp: days(60), pages: false }]) {
    const { d, stored } = deps(meta({ X: t }), 'X', null);
    assertEquals((await runAgencyHealthCheck(d)).state, 'invalid');
    assertEquals(stored.length, 0);
  }
});

Deno.test('near expiry: exchange is verified and saved only when it extends expiry', async () => {
  const m = meta({ CUR: { valid: true, exp: days(10) }, NEXT: { valid: true, exp: days(60) } }, { CUR: 'NEXT' });
  const { d, stored } = deps(m, 'CUR', 'CUR');
  const r = await runAgencyHealthCheck(d);
  assertEquals(r.state, 'healthy');
  assertEquals(r.renewable, true);
  assertEquals(stored, [{ token: 'NEXT', source: 'exchange' }]);
});

Deno.test('failed renewal keeps the working token and alerts', async () => {
  const m = meta({ CUR: { valid: true, exp: days(10) } }, {});
  const { d, stored } = deps(m, 'CUR', 'CUR');
  const r = await runAgencyHealthCheck(d);
  assertEquals(r.state, 'renewal_failed');
  assertEquals(r.renewable, false);
  assertEquals(stored.length, 0);
});

Deno.test('replacement that does not extend expiry is rejected', async () => {
  const m = meta({ CUR: { valid: true, exp: days(10) }, SAME: { valid: true, exp: days(10) } }, { CUR: 'SAME' });
  const { d, stored } = deps(m, 'CUR', 'CUR');
  assertEquals((await runAgencyHealthCheck(d)).state, 'renewal_failed');
  assertEquals(stored.length, 0);
});

Deno.test('non-expiring tokens are healthy and not renewed; 15-21 days left alerts as expiring', async () => {
  const a = deps(meta({ N: { valid: true, exp: null } }), 'N', 'N');
  assertEquals((await runAgencyHealthCheck(a.d)).state, 'healthy');
  const b = deps(meta({ S: { valid: true, exp: days(18) } }), 'S', 'S');
  assertEquals((await runAgencyHealthCheck(b.d)).state, 'expiring');
});

Deno.test('status never contains token values or the app secret', async () => {
  const m = meta({ SECRETTOKENVALUE: { valid: true, exp: days(10) } }, {});
  const { d, statuses } = deps(m, 'SECRETTOKENVALUE', 'SECRETTOKENVALUE');
  await runAgencyHealthCheck(d);
  const text = JSON.stringify(statuses);
  assert(!text.includes('SECRETTOKENVALUE') && !text.includes('SECRET"'));
});

Deno.test('getAgencyToken prefers the active unexpired stored token, else falls back to the secret', async () => {
  const db = (row: unknown, decrypted: string | null) => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) }),
    rpc: async () => ({ data: decrypted, error: null }),
  });
  const env = (k: string) => (k === 'META_ADS_ACCESS_TOKEN' ? 'ENV' : k === 'GHL_ENCRYPTION_KEY' ? 'K' : undefined);
  assertEquals(await getAgencyToken(db({ secret_id: 's', expires_at: days(5).toISOString() }, 'STORED'), env), 'STORED');
  assertEquals(await getAgencyToken(db({ secret_id: 's', expires_at: days(-1).toISOString() }, 'STORED'), env), 'ENV');
  assertEquals(await getAgencyToken(db(null, null), env), 'ENV');
});

Deno.test('verifyAgencyToken only calls the configured business and ad account', async () => {
  const m = meta({ T: { valid: true, exp: days(60) } });
  const r = await verifyAgencyToken(m.f, 'T', 'APP', 'SECRET', NOW);
  assert(r.ok);
  assert(m.calls.every((p) => /debug_token|act_2895514127400266|1832826473434326\/client_pages/.test(p)));
});

const at = (ms: number) => new Date(NOW.getTime() + ms);
const DAYMS = 86_400_000;

Deno.test('guidance is for Chris\'s Barber Launch app USER token, never a system user, and not perpetual', () => {
  assert(ROTATE_ACTION.includes('User Token') && ROTATE_ACTION.includes('2148309075723966') && ROTATE_ACTION.includes('META_ADS_ACCESS_TOKEN'));
  assert(!/system[- ]user/i.test(ROTATE_ACTION));
  assert(/not automatic or permanent/.test(ROTATE_ACTION));
});

Deno.test('null token expiry: data access 21 days + 1s away is healthy with no action', async () => {
  const { d } = deps(meta({ T: { valid: true, exp: null, da: at(21 * DAYMS + 1000) } }), 'T', 'T');
  const r = await runAgencyHealthCheck(d);
  assertEquals(r.state, 'healthy');
  assertEquals(r.action_required, null);
});

Deno.test('null token expiry: data access exactly 21 days away warns as expiring with the date and user-token steps', async () => {
  const da = at(21 * DAYMS);
  const { d, stored } = deps(meta({ T: { valid: true, exp: null, da } }), 'T', 'T');
  const r = await runAgencyHealthCheck(d);
  assertEquals(r.state, 'expiring');
  assert(r.action_required?.includes(da.toISOString()) && r.action_required.includes(ROTATE_ACTION));
  assertEquals(r.last_error_message, null);
  assertEquals(stored.length, 0);
});

Deno.test('data access ending at or after now is a clear expired failure; nothing promoted', async () => {
  for (const da of [at(0), at(-1000)]) {
    const { d, stored } = deps(meta({ T: { valid: true, exp: null, da } }), 'T', null);
    const r = await runAgencyHealthCheck(d);
    assertEquals(r.state, 'expired');
    assert(r.last_error_message?.includes('data access') && r.last_error_message.includes(da.toISOString()));
    assertEquals(r.action_required, ROTATE_ACTION);
    assertEquals(stored.length, 0);
  }
  const { d } = deps(meta({ T: { valid: true, exp: null, da: at(1000) } }), 'T', 'T');
  assertEquals((await runAgencyHealthCheck(d)).state, 'expiring');
});

Deno.test('re-authorized short-lived secret replaces the working token only via a verified, at-least-as-long exchange', async () => {
  const m = meta({ CUR: { valid: true, exp: null, da: days(10) }, NEW: { valid: true, exp: at(3_600_000), da: days(90) },
    NEXT: { valid: true, exp: null, da: days(90) } }, { NEW: 'NEXT' });
  const { d, stored } = deps(m, 'NEW', 'CUR');
  const r = await runAgencyHealthCheck(d);
  assertEquals(stored, [{ token: 'NEXT', source: 'exchange' }]);
  assertEquals(r.state, 'healthy');
  assertEquals(r.action_required, null);
  assertEquals(r.data_access_expires_at, days(90).toISOString());
});

Deno.test('re-authorization whose exchange fails keeps the working token and the warning', async () => {
  const m = meta({ CUR: { valid: true, exp: null, da: days(10) }, NEW: { valid: true, exp: at(3_600_000), da: days(90) } }, {});
  const { d, stored } = deps(m, 'NEW', 'CUR');
  const r = await runAgencyHealthCheck(d);
  assertEquals(stored.length, 0);
  assertEquals(r.state, 'expiring');
  assert(r.action_required?.includes(days(10).toISOString()));
});

Deno.test('renewal failure near the data-access deadline mentions that date', async () => {
  const { d } = deps(meta({ CUR: { valid: true, exp: days(10), da: days(5) } }, {}), 'CUR', 'CUR');
  const r = await runAgencyHealthCheck(d);
  assertEquals(r.state, 'renewal_failed');
  assert(r.action_required?.includes(days(5).toISOString()) && r.action_required.includes(ROTATE_ACTION));
});
