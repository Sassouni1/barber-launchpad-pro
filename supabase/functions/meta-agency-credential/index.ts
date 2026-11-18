// Scheduler/admin endpoint for the agency Meta token health check and renewal.
// Responses and logs carry only sanitized status; never token values or app secrets.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { AGENCY_TOKEN_ENV } from '../_shared/metaAgency.ts';
import { loadActiveAgencyToken, runAgencyHealthCheck, type StatusPatch } from '../_shared/metaAgencyCredential.ts';

const FUNCTION_VERSION = 'meta-agency-credential/2026-11-18';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function check() {
  const db = admin();
  const key = Deno.env.get('GHL_ENCRYPTION_KEY');
  return await runAgencyHealthCheck({
    fetch,
    now: () => new Date(),
    appId: Deno.env.get('FACEBOOK_APP_ID'),
    appSecret: Deno.env.get('FACEBOOK_APP_SECRET'),
    envToken: Deno.env.get(AGENCY_TOKEN_ENV),
    loadActive: async () => (key ? await loadActiveAgencyToken(db, key) : null),
    store: async (token, source, info) => {
      if (!key) throw Error('encryption_key_missing');
      const { data: secretId, error } = await db.rpc('store_encrypted_token', { token_value: token, encryption_key: key });
      if (error || !secretId) throw Error('credential_store_failed');
      const { error: actErr } = await db.rpc('meta_agency_activate_credential', {
        _secret_id: secretId, _source: source, _app_id: info.appId, _scopes: info.scopes,
        _expires_at: info.expiresAt?.toISOString() ?? null, _data_access_expires_at: info.dataAccessExpiresAt?.toISOString() ?? null,
      });
      if (actErr) throw Error('credential_activate_failed');
    },
    saveStatus: async (patch: StatusPatch) => {
      const { error } = await db.from('meta_agency_credential_status').update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw Error('status_save_failed');
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const cronToken = req.headers.get('x-cron-token');
  try {
    if (cronToken) {
      const { data: allowed, error } = await admin().rpc('verify_meta_agency_credential_cron_token', { _token: cronToken });
      if (error || allowed !== true) return json({ error: 'unauthorized' }, 401);
      const result = await check();
      console.log('meta_agency_credential_check', { state: result.state, code: result.last_error_code });
      return json({ ok: true, state: result.state });
    }
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(authHeader.slice(7));
    const userId = claims?.claims?.sub;
    if (claimsError || !userId) return json({ error: 'unauthorized' }, 401);
    const { data: role, error: roleError } = await admin().from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    if (roleError) return json({ error: 'Could not verify admin access.' }, 500);
    if (!role) return json({ error: 'Admins only.' }, 403);
    const body = await req.json().catch(() => ({})) as { action?: string };
    if (body.action === 'functionVersion') return json({ ok: true, version: FUNCTION_VERSION });
    if (body.action === 'check') {
      const result = await check();
      return json({ ok: true, status: result });
    }
    return json({ error: 'invalid_action' }, 400);
  } catch (err) {
    console.error('meta_agency_credential_error', err instanceof Error ? err.message : 'unknown');
    return json({ error: 'The agency token check could not finish. The current token was not changed.' }, 500);
  }
});
