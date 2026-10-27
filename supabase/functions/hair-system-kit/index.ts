import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { relayCall, relayProbe, relayDefinitelyDidNotSend } from '../_shared/barberLaunchGhlRelay.ts';
import { KIT_ENROLLMENT_OFFERS, processKit } from './logic.ts';
import { readStripeEvidence } from './readStripeEvidence.ts';
import { kitStorage } from './storage.ts';
import { hairSystemStripeKey } from '../_shared/hairSystemFulfillment.ts';

const Body = z.object({ action: z.enum(['diagnostics','dry_run']), order_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional() }).strict();
const WebhookBody = z.object({ order_id: z.string().regex(/^[a-f0-9]{24}$/i), phone: z.string().max(40).optional() }).passthrough();
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
    // The welcome workflow merges multiple products. The shared action is safe
    // only because the receiver re-reads the unique live Stripe payment and
    // checks its exact enrollment description, full price, and shipping.
    const stripeKey = hairSystemStripeKey();
    if (!stripeKey) return reply({ status: 'blocked', reason: 'stripe_key_unavailable' }, 503);
    const storage = kitStorage(db);
    const result = await processKit(body.data.order_id, { enabled: gate.enabled, cutoff: gate.activation_cutoff }, {
      readFresh: id => readStripeEvidence(id, body.data.phone ?? '', stripeKey),
      ensureRow: storage.ensureRow,
      confirmVisible: storage.confirmVisible,
      reserve: storage.reserve,
      releaseBeforeSend: storage.releaseBeforeSend,
      send: async mail => {
        const response = await relayCall('send_email', { role: mail.role, to: mail.to, name: 'New Times Hair', subject: mail.subject, html: mail.html });
        return response.ok ? { ok: true, messageId: response.messageId } : { ok: false, safeRetry: relayDefinitelyDidNotSend(response.reason) };
      },
      finish: storage.finish,
    }).catch(() => ({ status: 'error' }));
    // A blocked payment or missing shipping address must never become a supplier order.
    const temporaryFailure = result.status === 'error' ||
      (result.status === 'blocked' && 'reason' in result && ['fresh_stripe_reads_unavailable', 'supplier_page_visibility_unverified', 'supplier_delivery_not_attempted'].includes(result.reason ?? ''));
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
  if (parsed.data.action === 'dry_run' && parsed.data.order_id) {
    const key = hairSystemStripeKey();
    if (!key) return reply({ active: false, stripe_search: 'key_unavailable', writes: 0, outbound_messages: 0 }, 503);
    try {
      const e = await readStripeEvidence(parsed.data.order_id, '', key);
      return reply({ active: false, stripe_search: 'unique_payment_found', order_matches: e.order.id === parsed.data.order_id,
        recognized_offer_description: Object.values(KIT_ENROLLMENT_OFFERS).some(o => o.description === e.order.description),
        payment_succeeded: e.payment.status === 'succeeded' && e.payment.chargeStatus === 'succeeded',
        received_minor: e.payment.receivedMinor, refunded_minor: e.payment.refundedMinor,
        disputed: e.payment.disputed, shipping_complete: Boolean(e.shipping.name && e.shipping.address1 && e.shipping.city && e.shipping.state && e.shipping.postal_code && e.shipping.country),
        phone_in_stripe: false, writes: 0, outbound_messages: 0 });
    } catch (readError) {
      const reason = readError instanceof Error ? readError.message : 'stripe_read_failed';
      return reply({ active: false, stripe_search: reason, writes: 0, outbound_messages: 0 }, 503);
    }
  }
  return reply({ active: false, configured_enabled: gate?.enabled === true,
    activation_cutoff: gate?.activation_cutoff ?? null,
    relay, fresh_payment_reads: 'stripe_order_id_search_not_yet_verified_on_server', reason: 'workflow_order_id_and_phone_mapping_not_verified',
    writes: 0, outbound_messages: 0, order_id: parsed.data.order_id ?? null });
});
