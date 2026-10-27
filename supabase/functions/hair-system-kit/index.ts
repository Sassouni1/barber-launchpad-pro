import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { relayCall, relayProbe } from '../_shared/barberLaunchGhlRelay.ts';
import { processKit } from './logic.ts';
import { readGhlEvidence } from './readGhlEvidence.ts';
import { kitStorage } from './storage.ts';

const Body = z.object({ action: z.enum(['diagnostics','dry_run']), order_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional() }).strict();
const WebhookBody = z.object({ order_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }).passthrough();
async function validWebhookToken(value: string | null, secret: string): Promise<boolean> {
  if (!value || !secret || value.length !== secret.length) return false;
  const expected = new TextEncoder().encode(secret);
  const actual = new TextEncoder().encode(value);
  if (actual.length !== expected.length) return false;
  // Avoid a content-dependent comparison for the shared webhook secret.
  const key = await crypto.subtle.importKey('raw', expected, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, actual));
  const self = new Uint8Array(await crypto.subtle.sign('HMAC', key, expected));
  let difference = 0;
  for (let i = 0; i < mac.length; i++) difference |= mac[i] ^ self[i];
  return difference === 0;
}
Deno.serve(async req => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return reply({ error: 'backend_unavailable' }, 503);
  const db = createClient(url, service);
  if (new URL(req.url).pathname.endsWith('/hair-system-kit/webhook')) {
    const secret = Deno.env.get('KIT_WEBHOOK_SECRET') ?? '';
    if (secret.length < 32) return reply({ error: 'webhook_not_configured' }, 503);
    if (!await validWebhookToken(req.headers.get('x-kit-webhook-token'), secret)) return reply({ error: 'unauthorized' }, 401);
    const body = WebhookBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return reply({ error: 'invalid_request' }, 400);
    const { data: gate, error } = await db.from('hair_system_kit_activation').select('enabled,activation_cutoff').eq('singleton', true).maybeSingle();
    if (error || !gate) return reply({ error: 'activation_state_unavailable' }, 503);
    if (gate.enabled !== true) return reply({ status: 'inactive' });
    const storage = kitStorage(db);
    const result = await processKit(body.data.order_id, { enabled: gate.enabled, cutoff: gate.activation_cutoff }, {
      readFresh: id => readGhlEvidence(db, id),
      ensureRow: storage.ensureRow,
      confirmVisible: storage.confirmVisible,
      reserve: storage.reserve,
      send: async mail => {
        const response = await relayCall('send_email', { role: mail.role, to: mail.to, name: 'New Times Hair', subject: mail.subject, html: mail.html });
        return response.ok ? { ok: true, messageId: response.messageId } : { ok: false };
      },
      finish: storage.finish,
    }).catch(() => ({ status: 'error' }));
    // A blocked payment or missing shipping address must never become a supplier order.
    const temporaryFailure = result.status === 'error' ||
      (result.status === 'blocked' && 'reason' in result && ['fresh_ghl_reads_unavailable', 'supplier_page_visibility_unverified'].includes(result.reason ?? ''));
    return reply(result, temporaryFailure ? 503 : 200);
  }
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return reply({ error: 'unauthorized' }, 401);
  const userClient = createClient(url, anon);
  const { data: user, error: authError } = await userClient.auth.getUser(auth.slice(7));
  if (authError || !user.user) return reply({ error: 'unauthorized' }, 401);
  const { data: admin, error: roleError } = await db.rpc('has_role', { _user_id: user.user.id, _role: 'admin' });
  if (roleError || admin !== true) return reply({ error: 'forbidden' }, 403);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (parsed.data.action === 'dry_run' && !parsed.data.order_id)) return reply({ error: 'invalid_request' }, 400);
  const { data: gate, error } = await db.from('hair_system_kit_activation').select('enabled,activation_cutoff').eq('singleton', true).maybeSingle();
  if (error) return reply({ active: false, reason: 'activation_state_unavailable' }, 503);
  const relay = await relayProbe();
  return reply({ active: false, configured_enabled: gate?.enabled === true, activation_cutoff: gate?.activation_cutoff ?? null,
    relay, fresh_payment_reads: 'requires_payments_read_oauth_scope', reason: 'workflow_order_id_mapping_and_live_ghl_payment_read_not_verified',
    writes: 0, outbound_messages: 0, order_id: parsed.data.order_id ?? null });
});
