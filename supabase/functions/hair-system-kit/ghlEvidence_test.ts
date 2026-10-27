import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { evidenceFromGhl } from './ghlEvidence.ts';
import { KIT_LINK, KIT_LOCATION, KIT_PRICE, KIT_PRODUCT, qualifyKit } from './logic.ts';

function paidFixture() {
  const now = Date.now();
  const createdAt = new Date(now - 20_000).toISOString();
  const paidSeconds = Math.floor((now - 10_000) / 1000);
  const order = { _id: 'ghl-order', altId: KIT_LOCATION, contactId: 'contact-1', createdAt,
    status: 'completed', paymentStatus: 'paid', liveMode: true,
    source: { id: KIT_LINK }, items: [{ product: { _id: KIT_PRODUCT }, price: { _id: KIT_PRICE, type: 'one_time' }, qty: 1 }],
    contactSnapshot: { email: 'buyer@example.com', phone: '+17275550100', address1: 'OLD BILLING ADDRESS' } };
  const tx = { _id: 'ghl-transaction', altId: KIT_LOCATION, contactId: 'contact-1', entityId: 'ghl-order',
    chargeId: 'pi_paid', status: 'succeeded', amount: 2997, amountRefunded: 0, currency: 'usd', liveMode: true,
    chargeSnapshot: { id: 'pi_paid', status: 'succeeded', livemode: true, amount_received: 299700,
      currency: 'usd', metadata: { orderId: 'ghl-order' },
      shipping: { name: 'Buyer Name', address: { line1: 'REAL SHIPPING ADDRESS', city: 'City', state: 'FL', postal_code: '33764', country: 'US' } },
      charges: { data: [{ created: paidSeconds, amount_refunded: 0, disputed: false, refunded: false, paid: true, captured: true }] } },
    paymentProviders: [{ chargeSnapshot: { status: 'requires_payment_method', amount_received: 0 } }] };
  return { order, tx, cutoff: new Date(now - 30_000).toISOString() };
}

Deno.test('current transaction verifies paid kit and keeps charge shipping, not stale provider or billing data', () => {
  const { order, tx, cutoff } = paidFixture();
  const evidence = evidenceFromGhl(order, tx);
  assertEquals(qualifyKit(evidence, order._id, cutoff), null);
  assertEquals(evidence.shipping.address1, 'REAL SHIPPING ADDRESS');
  assertEquals(evidence.transaction.receivedMinor, 299700);
});
Deno.test('small or pending transaction never qualifies', () => {
  const { order, tx, cutoff } = paidFixture();
  tx.amount = 1000;
  tx.chargeSnapshot.amount_received = 100000;
  assertEquals(qualifyKit(evidenceFromGhl(order, tx), order._id, cutoff), 'received_amount_not_verified');
  tx.status = 'pending';
  assertEquals(qualifyKit(evidenceFromGhl(order, tx), order._id, cutoff), 'payment_not_completed');
});
Deno.test('mismatched GHL order identity is rejected before eligibility', () => {
  const { order, tx } = paidFixture();
  tx.chargeSnapshot.metadata.orderId = 'another-order';
  assertThrows(() => evidenceFromGhl(order, tx), Error, 'ghl_payment_linkage_unverified');
});
