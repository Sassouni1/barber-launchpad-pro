import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { KIT_LOCATION, KIT_STRIPE_APPLICATION, KIT_ENROLLMENT_DESCRIPTION, KIT_ENROLLMENT_OFFERS, KIT_1997_PRODUCT,
  qualifyKit, processKit } from '../hairSystemKit/logic.ts';
import { evidenceFromStripe } from '../hairSystemKit/stripeEvidence.ts';
import { kitPaymentEvent } from '../hairSystemKit/stripeEvent.ts';
import { certificationTrialStatus, enrollmentSearchLeads, runAfterResponseOrAwait, qualifyEnrollment, recordEnrollment,
  type EnrollmentRow, type StoredEnrollment } from './logic.ts';

const ORDER = '6ad7ab5ef9a0f5d86d850cb9';
const PI = 'pi_3UShHHI6LFtj88Bq0lgxtwUf';
const CHARGE = 'py_3UShHHI6LFtj88Bq0yG7CQrl';
const CONTACT = 'AbCdEfGhIjKlMnOpQrSt';
const BUYER = 'buyer@example.com';

function paid(opts: { amount?: number; description?: string; orderId?: string; location?: string; refunded?: number;
  status?: string; email?: string; shipping?: boolean; createdAgoS?: number } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const orderId = opts.orderId ?? ORDER, amount = opts.amount ?? 299700, description = opts.description ?? KIT_ENROLLMENT_DESCRIPTION;
  const metadata = { orderId, altId: opts.location ?? KIT_LOCATION, altType: 'location', contactId: CONTACT };
  const shipping = opts.shipping === false ? null
    : { name: 'Fixture Buyer', address: { line1: '1 Fixture St', line2: null, city: 'City', state: 'FL', postal_code: '33764', country: 'US' } };
  const created = now - (opts.createdAgoS ?? 20);
  return { id: PI, object: 'payment_intent', application: KIT_STRIPE_APPLICATION, metadata, description, created,
    livemode: true, status: opts.status ?? 'succeeded', currency: 'usd', amount_received: amount, shipping,
    latest_charge: { id: CHARGE, object: 'charge', application: KIT_STRIPE_APPLICATION, payment_intent: PI, metadata, description,
      created: created + 10, livemode: true, status: opts.status ?? 'succeeded', paid: (opts.status ?? 'succeeded') === 'succeeded',
      captured: true, amount_captured: amount, amount_refunded: opts.refunded ?? 0, disputed: false, dispute: null,
      refunded: false, shipping, billing_details: { email: opts.email ?? BUYER } } };
}
const ev = (opts = {}) => evidenceFromStripe(paid(opts), (opts as { orderId?: string }).orderId ?? ORDER, '');

function memoryStore() {
  const rows: (EnrollmentRow & { id: string; status: string })[] = [];
  return {
    rows,
    insertIfAbsent: async (row: EnrollmentRow) => {
      const same = rows.filter(r => r.ghl_order_id === row.ghl_order_id || r.stripe_payment_intent_id === row.stripe_payment_intent_id);
      if (!same.length) { rows.push({ ...row, id: crypto.randomUUID(), status: 'verified' }); return 'inserted' as const; }
      return same.length === 1 && same[0].ghl_order_id === row.ghl_order_id && same[0].stripe_payment_intent_id === row.stripe_payment_intent_id
        ? 'duplicate' as const : 'conflict' as const;
    },
  };
}
const record = (store: ReturnType<typeof memoryStore>, read: () => ReturnType<typeof ev>, contact: string | null = BUYER) =>
  recordEnrollment({ paymentId: PI, orderId: ORDER, source: 'stripe_webhook', eventId: 'evt_1' },
    { readFresh: async () => read(), contactEmail: async () => contact, insertIfAbsent: store.insertIfAbsent });

function trialDeps(opts: { facts?: { confirmed_account: boolean; certified: boolean; certified_at: string | null };
  rows?: StoredEnrollment[]; read?: () => ReturnType<typeof ev>; revoked?: string[] }) {
  return {
    facts: async () => opts.facts ?? { confirmed_account: true, certified: true, certified_at: '2026-03-04T05:06:07+00:00' },
    candidates: async () => opts.rows ?? [],
    readFresh: async () => (opts.read ?? (() => ev()))(),
    revoke: async (id: string) => { opts.revoked?.push(id); },
  };
}
const storedRow: StoredEnrollment = { id: 'row-1', ghl_order_id: ORDER, stripe_payment_intent_id: PI, paid_at: '2026-01-01T00:00:00Z' };

// Certificate issue date
Deno.test('certifiedAt is the earliest issued hair-system certificate date, null when not certified', async () => {
  const status = await certificationTrialStatus(BUYER, trialDeps({}));
  assertEquals(status.certified, true);
  assertEquals(status.certifiedAt, '2026-03-04T05:06:07.000Z');
  assertEquals(Object.keys(status).sort(), ['certified', 'certifiedAt', 'enrollmentOrderId', 'programStartedAt']);
  const none = await certificationTrialStatus(BUYER, trialDeps({ facts: { confirmed_account: true, certified: false, certified_at: null } }));
  assertEquals([none.certified, none.certifiedAt], [false, null]);
});

// Paid enrollment matching
Deno.test('verified paid enrollment for the confirmed email returns order ID and fresh paid time', async () => {
  const e = ev();
  const status = await certificationTrialStatus(BUYER, trialDeps({ rows: [storedRow], read: () => e }));
  assertEquals(status.enrollmentOrderId, ORDER);
  assertEquals(status.programStartedAt, e.order.paidAt);
  const store = memoryStore();
  assertEquals((await record(store, () => ev())).status, 'recorded');
  assertEquals(store.rows[0].contact_email_normalized, BUYER);
  assertEquals(store.rows[0].billing_email_normalized, BUYER);
  assertEquals(store.rows[0].paid_at, e.order.paidAt);
  // The $1997 offer accepted by the kit logic is accepted here too, at its own full price.
  const o1997 = KIT_ENROLLMENT_OFFERS[KIT_1997_PRODUCT].description;
  assertEquals(qualifyEnrollment(ev({ amount: 199700, description: o1997 }), ORDER), null);
});

Deno.test('unconfirmed account or no stored enrollment for that email returns null trial fields', async () => {
  const unconfirmed = await certificationTrialStatus(BUYER, trialDeps({ rows: [storedRow],
    facts: { confirmed_account: false, certified: false, certified_at: null } }));
  assertEquals([unconfirmed.enrollmentOrderId, unconfirmed.programStartedAt], [null, null]);
  const otherEmail = await certificationTrialStatus('someone-else@example.com', trialDeps({ rows: [] }));
  assertEquals([otherEmail.certified, otherEmail.enrollmentOrderId, otherEmail.programStartedAt], [true, null, null]);
});

// Wrong email / location
Deno.test('wrong location, wrong offer or missing email cannot become enrollment evidence', async () => {
  const wrongLocation = ev(); wrongLocation.order.locationId = wrongLocation.payment.locationId = 'OtherLocation000000';
  assertEquals(qualifyEnrollment(wrongLocation, ORDER), 'payment_linkage_missing');
  assertEquals(qualifyEnrollment(ev({ description: 'Another $2,997 Product' }), ORDER), 'wrong_order_or_offer');
  assertEquals(qualifyEnrollment(ev({ amount: 100000 }), ORDER), 'received_amount_not_verified');
  const store = memoryStore();
  assertEquals((await record(store, () => wrongLocation)).reason, 'payment_linkage_missing');
  assertEquals((await record(store, () => ev({ email: 'not-an-email' }), null)).reason, 'enrollment_email_missing');
  assertEquals(store.rows.length, 0);
  // Search hits from another location or offer are dropped before any re-read.
  assertEquals(enrollmentSearchLeads([paid({ location: 'OtherLocation000000' }), paid({ description: 'Other' }), { ...paid(), livemode: false }]), []);
  assertEquals(enrollmentSearchLeads([paid(), paid()]), [{ paymentId: PI, orderId: ORDER }]);
});

// Refunded / unpaid
Deno.test('refunded or unpaid orders are not recorded, and a later refund revokes and fails closed', async () => {
  const store = memoryStore();
  assertEquals((await record(store, () => ev({ refunded: 299700 }))).reason, 'refunded_or_unknown');
  assertEquals((await record(store, () => ev({ status: 'processing' }))).reason, 'payment_not_completed');
  assertEquals(store.rows.length, 0);
  const revoked: string[] = [];
  const status = await certificationTrialStatus(BUYER, trialDeps({ rows: [storedRow], read: () => ev({ refunded: 1 }), revoked }));
  assertEquals([status.enrollmentOrderId, status.programStartedAt, revoked], [null, null, ['row-1']]);
  assertEquals(status.certified, true);
});

Deno.test('Stripe or storage read failure keeps certified and returns null trial fields without revoking', async () => {
  const revoked: string[] = [];
  const status = await certificationTrialStatus(BUYER, trialDeps({ rows: [storedRow], revoked,
    read: () => { throw new Error('stripe_payment_read_500'); } }));
  assertEquals([status.certified, status.enrollmentOrderId, status.programStartedAt, revoked.length], [true, null, null, 0]);
  const deps = trialDeps({}); deps.candidates = async () => { throw new Error('db down'); };
  assertEquals((await certificationTrialStatus(BUYER, deps)).enrollmentOrderId, null);
  const store = memoryStore();
  const r = await recordEnrollment({ paymentId: PI, orderId: ORDER, source: 'stripe_webhook', eventId: 'evt_1' },
    { readFresh: async () => { throw new Error('down'); }, contactEmail: async () => BUYER, insertIfAbsent: store.insertIfAbsent });
  assertEquals([r.status, store.rows.length], ['unavailable', 0]);
});

// Duplicate webhook
Deno.test('duplicate webhook deliveries store one row; a conflicting order/payment pairing is blocked', async () => {
  const store = memoryStore();
  assertEquals((await record(store, () => ev())).status, 'recorded');
  assertEquals((await record(store, () => ev())).status, 'duplicate');
  assertEquals(store.rows.length, 1);
  const otherOrder = await recordEnrollment({ paymentId: PI, orderId: '6ad7ab5ef9a0f5d86d850cb0', source: 'backfill', eventId: null },
    { readFresh: async () => ev({ orderId: '6ad7ab5ef9a0f5d86d850cb0' }), contactEmail: async () => BUYER, insertIfAbsent: store.insertIfAbsent });
  assertEquals([otherOrder.status, otherOrder.reason, store.rows.length], ['blocked', 'existing_record_conflict', 1]);
});

// Existing kit path
Deno.test('kit path is unchanged: enrollment evidence does not relax kit cutoff, shipping or phone rules', async () => {
  const noShipping = ev({ shipping: false });
  assertEquals(qualifyEnrollment(noShipping, ORDER), null);
  assertEquals(qualifyKit(evidenceFromStripe(paid({ shipping: false }), ORDER, '+17275550100'), ORDER,
    new Date(Date.now() - 60_000).toISOString()), 'shipping_missing');
  assertEquals(qualifyKit(evidenceFromStripe(paid(), ORDER, ''), ORDER, new Date(Date.now() - 60_000).toISOString()), 'contact_missing');
  const historical = ev({ createdAgoS: 86_400 * 30 });
  assertEquals(qualifyEnrollment(historical, ORDER), null);
  assertEquals(qualifyKit(evidenceFromStripe(paid({ createdAgoS: 86_400 * 30 }), ORDER, '+17275550100'), ORDER,
    new Date(Date.now() - 86_400_000).toISOString()), 'historical_or_ambiguous_purchase');
  // The signed-event classifier is shared and still matches only enrollment intents.
  const event = { type: 'payment_intent.succeeded', livemode: true, data: { object: paid() } };
  assertEquals(kitPaymentEvent(event)?.orderId, ORDER);
  assertEquals(kitPaymentEvent({ ...event, data: { object: paid({ location: 'OtherLocation000000' }) } }), null);
  // Inactive kit gate stays inactive; recording enrollment touches none of the kit dependencies.
  const fail = () => { throw new Error('kit dependency must not run'); };
  assertEquals(await processKit(ORDER, { enabled: false, cutoff: '' }, { readFresh: fail, ensureRow: fail, confirmVisible: fail,
    reserve: fail, releaseBeforeSend: fail, send: fail, finish: fail }), { status: 'inactive' });
});

// Trial fields require an issued certificate with a valid issue date
Deno.test('uncertified paid buyer gets null trial fields and enrollment is never read', async () => {
  const touched: string[] = [];
  const deps = trialDeps({ rows: [storedRow], facts: { confirmed_account: true, certified: false, certified_at: null } });
  deps.candidates = async () => { touched.push('candidates'); return [storedRow]; };
  deps.readFresh = async () => { touched.push('stripe'); return ev(); };
  const status = await certificationTrialStatus(BUYER, deps);
  assertEquals(status, { certified: false, certifiedAt: null, programStartedAt: null, enrollmentOrderId: null });
  assertEquals(touched, []);
});

Deno.test('certified record without a valid issue date gets null trial fields', async () => {
  for (const certified_at of [null, '', 'not-a-date']) {
    const touched: string[] = [];
    const deps = trialDeps({ rows: [storedRow], facts: { confirmed_account: true, certified: true, certified_at } });
    deps.candidates = async () => { touched.push('candidates'); return [storedRow]; };
    const status = await certificationTrialStatus(BUYER, deps);
    assertEquals(status, { certified: true, certifiedAt: null, programStartedAt: null, enrollmentOrderId: null });
    assertEquals(touched, []);
  }
});

// Webhook enrollment task scheduling
Deno.test('enrollment task is handed to waitUntil when available, otherwise awaited to completion', async () => {
  const handed: Promise<unknown>[] = [];
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await runAfterResponseOrAwait(pending, { waitUntil: (task: Promise<unknown>) => handed.push(task) });
  assertEquals(handed.length, 1);
  release();
  let finished = false;
  const slow = new Promise<void>(resolve => setTimeout(() => { finished = true; resolve(); }, 20));
  await runAfterResponseOrAwait(slow, undefined);
  assertEquals(finished, true);
  let finishedNoMethod = false;
  await runAfterResponseOrAwait(new Promise<void>(resolve => setTimeout(() => { finishedNoMethod = true; resolve(); }, 10)), {});
  assertEquals(finishedNoMethod, true);
});
