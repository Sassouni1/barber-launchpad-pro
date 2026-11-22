// Admin-only backfill of verified paid Barber Launch program enrollments
// (GHL payment_link orders, The Barber Launch location) for the Vlix trial.
// Read-only toward Stripe and GHL. Writes only program_enrollment_evidence.
// Never sends email/SMS, charges, or creates orders/kit/supplier records.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { corsHeaders } from '../_shared/cors.ts';
import { ghlContactEmail } from '../_shared/barberLaunchGhlRelay.ts';
import { hairSystemStripeKey } from '../_shared/hairSystemFulfillment.ts';
import { authorizeKitAdmin } from '../_shared/hairSystemKit/manual.ts';
import { KIT_STRIPE_ACCOUNT } from '../_shared/hairSystemKit/logic.ts';
import { readStripeEvidence, readStripeEvidenceByPaymentIntent } from '../_shared/hairSystemKit/readStripeEvidence.ts';
import { ENROLLMENT_LOCATION, enrollmentSearchLeads, qualifyEnrollment, recordEnrollment } from '../_shared/programEnrollment/logic.ts';
import { enrollmentStore } from '../_shared/programEnrollment/server.ts';

const OrderId = z.string().regex(/^[a-f0-9]{24}$/i);
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('preview'), page: z.string().max(500).optional(), limit: z.number().int().min(1).max(100).optional() }).strict(),
  z.object({ action: z.literal('apply'), orderIds: z.array(OrderId).min(1).max(25), confirm: z.literal(true) }).strict(),
]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function stripeGet(path: string, token: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`stripe_read_${res.status}`);
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const auth = await authorizeKitAdmin(req.headers.get('Authorization'),
    async token => (await db.auth.getUser(token)).data.user?.id ?? null,
    async userId => (await db.rpc('has_role', { _user_id: userId, _role: 'admin' })).data === true);
  if (!auth.ok) return json({ error: auth.status === 401 ? 'Sign in required' : 'Admins only' }, auth.status);

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch { return json({ error: 'Invalid request' }, 400); }
  const key = hairSystemStripeKey();
  if (!key) return json({ error: 'Stripe not configured' }, 503);
  const store = enrollmentStore(db);

  if (body.action === 'preview') {
    // Dry run: discover leads, re-verify each, report. No writes.
    let account: Record<string, unknown>;
    try { account = await stripeGet('/account', key); } catch { return json({ error: 'Stripe read failed' }, 503); }
    if (account.id !== KIT_STRIPE_ACCOUNT) return json({ error: 'Wrong Stripe seller account' }, 409);
    const query = encodeURIComponent(`metadata['altId']:'${ENROLLMENT_LOCATION}' AND status:'succeeded'`);
    let search: Record<string, unknown>;
    try {
      search = await stripeGet(`/payment_intents/search?query=${query}&limit=100${body.page ? `&page=${encodeURIComponent(body.page)}` : ''}`, key);
    } catch { return json({ error: 'Stripe search failed' }, 503); }
    const hits = Array.isArray(search.data) ? search.data : [];
    const leads = enrollmentSearchLeads(hits).slice(0, body.limit ?? 100);
    const orders = [];
    for (const lead of leads) {
      const { data: existing } = await db.from('program_enrollment_evidence').select('status').eq('ghl_order_id', lead.orderId).maybeSingle();
      try {
        const e = await readStripeEvidenceByPaymentIntent(lead.paymentId, lead.orderId, '', key);
        const reason = qualifyEnrollment(e, lead.orderId);
        let contactEmailFound = false;
        try { contactEmailFound = Boolean(await ghlContactEmail(e.payment.contactId)); } catch { /* reported as false */ }
        orders.push({ orderId: lead.orderId, offer: e.order.description, paidAt: e.order.paidAt,
          amountMinor: e.payment.receivedMinor, verified: !reason, reason: reason ?? null,
          contactEmailFound, billingEmailFound: Boolean(e.contact.email), stored: existing?.status ?? null });
      } catch (error) {
        orders.push({ orderId: lead.orderId, verified: false, reason: error instanceof Error ? error.message : 'read_failed', stored: existing?.status ?? null });
      }
    }
    return json({ dryRun: true, searchHits: hits.length, enrollmentLeads: enrollmentSearchLeads(hits).length,
      checked: orders.length, nextPage: search.has_more === true ? search.next_page ?? null : null, orders });
  }

  // Apply: explicit order IDs only. Each is bound to exactly one PaymentIntent
  // by Stripe search, then re-retrieved and qualified before storing.
  const results = [];
  for (const orderId of body.orderIds) {
    let paymentId: string;
    try { paymentId = (await readStripeEvidence(orderId, '', key)).payment.id; }
    catch (error) { results.push({ orderId, status: 'unavailable', reason: error instanceof Error ? error.message : 'read_failed' }); continue; }
    const result = await recordEnrollment({ paymentId, orderId, source: 'backfill', eventId: null }, {
      readFresh: (pi, id) => readStripeEvidenceByPaymentIntent(pi, id, '', key),
      contactEmail: ghlContactEmail,
      insertIfAbsent: store.insertIfAbsent,
    }).catch(() => ({ status: 'unavailable', reason: 'storage_failed' }));
    results.push({ orderId, ...result });
  }
  console.log('program enrollment backfill', JSON.stringify({ admin: auth.userId, count: results.length,
    recorded: results.filter(r => r.status === 'recorded').length }));
  return json({ dryRun: false, results });
});
