import { assertEquals, assertThrows, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { KIT_LOCATION, KIT_STRIPE_ACCOUNT, KIT_STRIPE_APPLICATION, KIT_ENROLLMENT_DESCRIPTION,
  KIT_ITEMS, KIT_1997_PRODUCT, KIT_ENROLLMENT_OFFERS, kitEmail, kitEnrollmentOffer, kitOrderRow, qualifyKit, processKit } from './logic.ts';
import { evidenceFromStripe } from './stripeEvidence.ts';
import { readStripeEvidence, readStripeEvidenceByPaymentIntent } from './readStripeEvidence.ts';
import { kitPaymentEvent } from './stripeEvent.ts';
import { relayDefinitelyDidNotSend } from '../_shared/barberLaunchGhlRelay.ts';

const ORDER = '6ad7ab5ef9a0f5d86d850cb9';
const ORDER_1997 = '69b02cf0978001814a5adf77';
const PI = 'pi_3UShHHI6LFtj88Bq0lgxtwUf';
const CHARGE = 'py_3UShHHI6LFtj88Bq0yG7CQrl';
function paidFixture(amountMinor = 299700, description: string = KIT_ENROLLMENT_DESCRIPTION, orderId = ORDER) {
  const now = Math.floor(Date.now() / 1000);
  const metadata = { orderId, altId: KIT_LOCATION, altType: 'location', contactId: 'ghl-contact' };
  const shipping = { name: 'Fixture Buyer', address: { line1: '1 Fixture St', line2: null, city: 'City', state: 'FL', postal_code: '33764', country: 'US' } };
  return { id: PI, object: 'payment_intent', application: KIT_STRIPE_APPLICATION, metadata,
    description, created: now - 20, livemode: true, status: 'succeeded', currency: 'usd', amount_received: amountMinor,
    shipping, latest_charge: { id: CHARGE, object: 'charge', application: KIT_STRIPE_APPLICATION, payment_intent: PI,
      metadata, description, created: now - 10, livemode: true, status: 'succeeded',
      paid: true, captured: true, amount_captured: amountMinor, amount_refunded: 0, disputed: false, dispute: null, refunded: false,
      shipping, billing_details: { email: 'fixture@example.com' } } };
}
const evidence = () => evidenceFromStripe(paidFixture(), ORDER, '+17275550100');
const evidence1997 = () => evidenceFromStripe(paidFixture(199700, KIT_ENROLLMENT_OFFERS[KIT_1997_PRODUCT].description, ORDER_1997), ORDER_1997, '+17275550101');
const cutoff = () => new Date(Date.now() - 60_000).toISOString();

Deno.test('exact GHL order metadata binds fresh paid Stripe charge and real shipping', () => {
  const e = evidence();
  assertEquals(qualifyKit(e, ORDER, cutoff()), null);
  assertEquals(e.shipping.address1, '1 Fixture St');
  const row = kitOrderRow(e);
  assertEquals(row.external_order_id, ORDER);
  assertEquals(row.payment_reference, `stripe:${PI}`);
  assertEquals(row.user_id, null);
  assertEquals(row.order_details.order.line_items.map(i => i.title), KIT_ITEMS);
  const mail = kitEmail(ORDER, e);
  assertEquals(mail.to, 'sales30@newtimeshair.com');
  assertEquals(mail.subject, 'New Hair System Kit Order');
  assertEquals(mail.html.includes(`https://member.thebarberlaunch.com/newtimes?order=${ORDER}`), true);
  assertEquals(mail.html.includes('New order for Fixture Buyer at 1 Fixture St, City, FL, 33764, US.'), true);
  assertEquals(mail.html.includes('C22 spray'), false);
});
Deno.test('wrong order or location metadata fails before qualification', () => {
  const p = paidFixture(); p.metadata.orderId = 'different';
  assertThrows(() => evidenceFromStripe(p, ORDER, '+17275550100'), Error, 'stripe_order_linkage_unverified');
  const q = paidFixture(); q.latest_charge.metadata.altId = 'another-location';
  assertThrows(() => evidenceFromStripe(q, ORDER, '+17275550100'), Error, 'stripe_order_linkage_unverified');
});
Deno.test('smaller, pending, refunded or disputed payments cannot release a kit', () => {
  const small = evidence(); small.payment.receivedMinor = small.payment.chargeAmountMinor = 100000;
  assertEquals(qualifyKit(small, ORDER, cutoff()), 'received_amount_not_verified');
  const pending = evidence(); pending.payment.status = 'processing';
  assertEquals(qualifyKit(pending, ORDER, cutoff()), 'payment_not_completed');
  const refunded = evidence(); refunded.payment.refundedMinor = 1;
  assertEquals(qualifyKit(refunded, ORDER, cutoff()), 'refunded_or_unknown');
  const disputed = evidence(); disputed.payment.disputed = true;
  assertEquals(qualifyKit(disputed, ORDER, cutoff()), 'payment_not_completed');
});
Deno.test('wrong enrollment title, missing phone or shipping, and old purchase block kit', () => {
  const other = evidence(); other.order.description = 'Another $2,997 Product';
  assertEquals(qualifyKit(other, ORDER, cutoff()), 'wrong_order_or_offer');
  const noPhone = evidence(); noPhone.contact.phone = '';
  assertEquals(qualifyKit(noPhone, ORDER, cutoff()), 'contact_missing');
  const noShipping = evidence(); noShipping.shipping.address1 = '';
  assertEquals(qualifyKit(noShipping, ORDER, cutoff()), 'shipping_missing');
  const old = evidence(); old.order.createdAt = '2026-01-01T00:00:00Z';
  assertEquals(qualifyKit(old, ORDER, cutoff()), 'historical_or_ambiguous_purchase');
});
Deno.test('each identified enrollment has its own verified full-payment threshold', () => {
  assertEquals(kitEnrollmentOffer(KIT_ENROLLMENT_DESCRIPTION)?.minimumReceivedMinor, 299700);
  assertEquals(kitEnrollmentOffer(KIT_ENROLLMENT_OFFERS[KIT_1997_PRODUCT].description)?.minimumReceivedMinor, 199700);
  assertEquals(kitEnrollmentOffer('unrelated-product'), null);
  assertEquals(qualifyKit(evidence1997(), ORDER_1997, cutoff()), null);
  for (const amount of [50000, 80000, 100000]) {
    const installment = evidence1997(); installment.payment.receivedMinor = installment.payment.chargeAmountMinor = amount;
    assertEquals(qualifyKit(installment, ORDER_1997, cutoff()), 'received_amount_not_verified');
  }
  const missingShipping = evidence1997(); missingShipping.shipping.address1 = '';
  assertEquals(qualifyKit(missingShipping, ORDER_1997, cutoff()), 'shipping_missing');
});

function fetchFixture(search: unknown): typeof fetch {
  return (async (url: string | URL | Request) => {
    const path = new URL(String(url)).pathname;
    if (path === '/v1/account') return Response.json({ id: KIT_STRIPE_ACCOUNT });
    if (path === '/v1/payment_intents/search') return Response.json(search);
    if (path === `/v1/payment_intents/${PI}`) return Response.json(paidFixture());
    return Response.json({ error: 'unexpected request' }, { status: 404 });
  }) as typeof fetch;
}
Deno.test('search by order ID retrieves the unique PI and checks current charge', async () => {
  const result = await readStripeEvidence(ORDER, '+17275550100', 'fixture-token', fetchFixture({ data: [{ id: PI }], has_more: false }));
  assertEquals(result.payment.id, PI);
  assertEquals(qualifyKit(result, ORDER, cutoff()), null);
});
Deno.test('signed event classifier accepts only GHL enrollment intents', () => {
  const event = { type: 'payment_intent.succeeded', livemode: true, data: { object: paidFixture() } };
  const fixture = event.data.object;
  fixture.metadata.contactId = 'WYSQw4kAYQxVIDtxit0w';
  assertEquals(kitPaymentEvent(event), { orderId: ORDER, paymentId: PI, contactId: 'WYSQw4kAYQxVIDtxit0w' });
  assertEquals(kitPaymentEvent({ ...event, type: 'charge.succeeded' }), null);
  assertEquals(kitPaymentEvent({ ...event, livemode: false }), null);
  assertEquals(kitPaymentEvent({ ...event, data: { object: { ...fixture, application: 'another-app' } } }), null);
  assertEquals(kitPaymentEvent({ ...event, data: { object: { ...fixture, description: 'Other purchase' } } }), null);
  const installment = { ...fixture, amount_received: 50000 };
  assertEquals(kitPaymentEvent({ ...event, data: { object: installment } })?.orderId, ORDER);
  assertEquals(qualifyKit(evidenceFromStripe({ ...paidFixture(50000), metadata: fixture.metadata,
    latest_charge: { ...paidFixture(50000).latest_charge, metadata: fixture.metadata } }, ORDER, '+17275550100'), ORDER, cutoff()), 'received_amount_not_verified');
});
Deno.test('signed event path re-reads the exact current PaymentIntent and charge', async () => {
  const result = await readStripeEvidenceByPaymentIntent(PI, ORDER, '+17275550100', 'fixture-token', fetchFixture({}));
  assertEquals(qualifyKit(result, ORDER, cutoff()), null);
  await assertRejects(() => readStripeEvidenceByPaymentIntent('pi_wrong', ORDER, '+17275550100', 'fixture-token', fetchFixture({})), Error);
});
Deno.test('missing or ambiguous search fails closed for retry; no amount/email matching', async () => {
  await assertRejects(() => readStripeEvidence(ORDER, '+17275550100', 'fixture-token', fetchFixture({ data: [], has_more: false }), []), Error, 'stripe_payment_not_indexed');
  await assertRejects(() => readStripeEvidence(ORDER, '+17275550100', 'fixture-token', fetchFixture({ data: [{ id: PI }, { id: 'pi_other' }], has_more: false }), []), Error, 'stripe_payment_ambiguous');
  await assertRejects(() => readStripeEvidence(ORDER, '+17275550100', 'fixture-token', fetchFixture({ data: [{ id: PI }], has_more: true }), []), Error, 'stripe_payment_ambiguous');
});
Deno.test('missing first search result retries once, then retrieves current PI', async () => {
  let searches = 0;
  const base = fetchFixture({ data: [{ id: PI }], has_more: false });
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    if (new URL(String(url)).pathname === '/v1/payment_intents/search' && ++searches === 1) {
      return Response.json({ data: [], has_more: false });
    }
    return base(url, init);
  }) as typeof fetch;
  const result = await readStripeEvidence(ORDER, '+17275550100', 'fixture-token', fetcher, [0]);
  assertEquals(result.payment.id, PI);
  assertEquals(searches, 2);
});
Deno.test('inactive gate and duplicate reservation produce no extra supplier mail', async () => {
  let sends = 0, rows = 0, reads = 0, reserved = false;
  const d = { readFresh: async () => { reads++; return evidence(); }, ensureRow: async () => { rows++; return 'row'; }, confirmVisible: async () => true,
    reserve: async () => { if (reserved) return false; reserved = true; return true; },
    releaseBeforeSend: async () => { reserved = false; },
    send: async () => { sends++; return { ok: true, messageId: 'msg' }; }, finish: async () => {} };
  assertEquals((await processKit(ORDER, null, d)).status, 'inactive');
  assertEquals(rows, 0);
  assertEquals(reads, 0);
  assertEquals((await processKit(ORDER, { enabled: true, cutoff: cutoff() }, d)).status, 'sent');
  assertEquals((await processKit(ORDER, { enabled: true, cutoff: cutoff() }, d)).status, 'reserved_no_retry');
  assertEquals(sends, 1);
});
Deno.test('a fully paid $1,997 enrollment with shipping sends once; incomplete shipping sends none', async () => {
  let sends = 0, rows = 0, reserved = false;
  let current = evidence1997();
  const d = { readFresh: async () => current, ensureRow: async (row: ReturnType<typeof kitOrderRow>) => {
    rows++; assertEquals(row.external_order_id, ORDER_1997); return 'row-1997'; }, confirmVisible: async () => true,
    reserve: async () => { if (reserved) return false; reserved = true; return true; },
    releaseBeforeSend: async () => { reserved = false; },
    send: async () => { sends++; return { ok: true, messageId: 'msg-1997' }; }, finish: async () => {} };
  current.shipping.address1 = '';
  assertEquals((await processKit(ORDER_1997, { enabled: true, cutoff: cutoff() }, d)).status, 'blocked');
  assertEquals(rows, 0); assertEquals(sends, 0);
  current = evidence1997();
  assertEquals((await processKit(ORDER_1997, { enabled: true, cutoff: cutoff() }, d)).status, 'sent');
  assertEquals((await processKit(ORDER_1997, { enabled: true, cutoff: cutoff() }, d)).status, 'reserved_no_retry');
  assertEquals(rows, 2); assertEquals(sends, 1);
});
Deno.test('definite pre-send failure releases reservation and retries once', async () => {
  let reserved = false, sends = 0, releases = 0;
  const d = { readFresh: async () => evidence(), ensureRow: async () => 'row', confirmVisible: async () => true,
    reserve: async () => { if (reserved) return false; reserved = true; return true; },
    releaseBeforeSend: async () => { releases++; reserved = false; },
    send: async () => { sends++; return sends === 1 ? { ok: false, safeRetry: true } : { ok: true, messageId: 'msg' }; },
    finish: async () => {} };
  assertEquals(await processKit(ORDER, { enabled: true, cutoff: cutoff() }, d), { status: 'blocked', reason: 'supplier_delivery_not_attempted' });
  assertEquals((await processKit(ORDER, { enabled: true, cutoff: cutoff() }, d)).status, 'sent');
  assertEquals((await processKit(ORDER, { enabled: true, cutoff: cutoff() }, d)).status, 'reserved_no_retry');
  assertEquals({ sends, releases }, { sends: 2, releases: 1 });
});
Deno.test('ambiguous relay failure keeps reservation and never resends automatically', async () => {
  let reserved = false, sends = 0, releases = 0;
  const d = { readFresh: async () => evidence(), ensureRow: async () => 'row', confirmVisible: async () => true,
    reserve: async () => { if (reserved) return false; reserved = true; return true; },
    releaseBeforeSend: async () => { releases++; reserved = false; },
    send: async () => { sends++; return { ok: false, safeRetry: false }; }, finish: async () => {} };
  assertEquals((await processKit(ORDER, { enabled: true, cutoff: cutoff() }, d)).status, 'uncertain');
  assertEquals((await processKit(ORDER, { enabled: true, cutoff: cutoff() }, d)).status, 'reserved_no_retry');
  assertEquals({ sends, releases }, { sends: 1, releases: 0 });
});
Deno.test('only relay failures known to precede sending can retry', () => {
  assertEquals(relayDefinitelyDidNotSend('relay_key_missing'), true);
  assertEquals(relayDefinitelyDidNotSend('relay_send_email_http_401:Unauthorized'), true);
  assertEquals(relayDefinitelyDidNotSend('relay_send_email_http_503:vlix_oauth_not_connected'), true);
  assertEquals(relayDefinitelyDidNotSend('relay_send_email_error:fetch failed'), false);
  assertEquals(relayDefinitelyDidNotSend('relay_send_email_http_500:unknown'), false);
});
