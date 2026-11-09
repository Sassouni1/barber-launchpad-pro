import test from 'node:test';
import assert from 'node:assert/strict';
import { manualKitRecovery } from '../supabase/functions/_shared/hairSystemKit/manualRecovery.ts';
import { KIT_ENROLLMENT_DESCRIPTION, KIT_2997_PRODUCT, KIT_ITEMS, KIT_LOCATION, KIT_STRIPE_APPLICATION } from '../supabase/functions/_shared/hairSystemKit/logic.ts';
import { authorizeKitAdmin } from '../supabase/functions/_shared/hairSystemKit/manual.ts';

const orderId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const contactId = 'bbbbbbbbbbbbbbbbbbbb';
const address = { name: 'Fixture Buyer', address1: '1 Test St', address2: '', city: 'Fixture City', state: 'NY', postal_code: '10001', country: 'US' };
const input = (payment_id = 'pi_fixture1', release_basis = 'fully_paid') => ({ order_id: orderId, payment_id, contact_id: contactId,
  shipping: address, shipping_confirmed: true, address_evidence: 'Owner confirmed purchase address with buyer',
  reason: 'Paid enrollment kit missed the supplier queue', release_basis });
const payment = (id = 'pi_fixture1', amount = 299700) => ({ readAt: new Date().toISOString(),
  order: { id: orderId, locationId: KIT_LOCATION, description: KIT_ENROLLMENT_DESCRIPTION, createdAt: new Date().toISOString(), paidAt: new Date().toISOString() },
  payment: { id, orderId, locationId: KIT_LOCATION, contactId, application: KIT_STRIPE_APPLICATION, live: true,
    status: 'succeeded', currency: 'usd', receivedMinor: amount, chargeId: 'ch_fixture1', chargeStatus: 'succeeded',
    chargePaid: true, chargeCaptured: true, chargeAmountMinor: amount, refundedMinor: 0, disputed: false },
  shipping: { name: '', address1: '', address2: '', city: '', state: '', postal_code: '', country: '' },
  contact: { email: 'fixture@example.com', phone: '+12125550100' } });
const order = (paymentStatus = 'paid') => ({ id: orderId, locationId: KIT_LOCATION, contactId,
  productIds: [KIT_2997_PRODUCT], paymentStatus, status: 'completed', updatedAt: '2026-11-09T00:00:00Z' });
const opts = { adminId: 'admin-fixture', secret: 'a-long-fixture-secret-for-manual-preview' };

function harness(e = payment(), g = order()) {
  const state = { claims: new Set(), rows: new Set(), delivery: null, sends: 0, writes: 0, email: null,
    evidence: e, ghl: g, existing: false };
  const deps = {
    readFresh: async () => ({ evidence: state.evidence, order: state.ghl }),
    checkExisting: async () => { if (state.existing || state.rows.has(orderId) || state.delivery) throw Error('existing_order_or_delivery'); },
    claim: async facts => { if (state.claims.has(facts.order_id)) throw Error('duplicate_claim'); state.claims.add(facts.order_id); state.writes++; },
    ensureRow: async row => { state.rows.add(row.external_order_id); state.writes++; assert.deepEqual(row.order_details.order.line_items.map(i => i.title), KIT_ITEMS); return 'row-1'; },
    confirmVisible: async () => true,
    reserve: async () => { if (state.delivery) return false; state.delivery = 'reserved'; state.writes++; return true; },
    send: async mail => { state.sends++; state.email = mail; return { ok: true, messageId: 'fixture-message' }; },
    finishDelivery: async (_id, status) => { state.delivery = status; state.writes++; },
    finishClaim: async () => { state.writes++; },
    verifyResult: async () => true,
  };
  return { state, deps };
}
test('preview is read-only, binds address, admin, current payment and exact kit', async () => {
  const h = harness();
  const ready = await manualKitRecovery('preview', input(), opts, h.deps);
  assert.equal(ready.status, 'ready'); assert.equal(h.state.writes, 0); assert.equal(h.state.sends, 0);
  assert.equal(ready.facts.supplier, 'sales30@newtimeshair.com');
  assert.deepEqual(ready.facts.kit_items, KIT_ITEMS);
  const changed = await manualKitRecovery('confirm', { ...input(), shipping: { ...address, address1: '2 Test St' } },
    { ...opts, previewToken: ready.preview_token, previewExpires: ready.preview_expires, confirmText: 'SEND ONE KIT TO NEW TIMES' }, h.deps);
  assert.equal(changed.reason, 'preview_changed_or_expired'); assert.equal(h.state.writes, 0);
});
test('one confirmation claims, creates and sends once; concurrent and different installment cannot send twice', async () => {
  const h = harness(payment('pi_month1', 80000), order('partially_paid'));
  const request = input('pi_month1', 'installment_entitlement');
  const ready = await manualKitRecovery('preview', request, opts, h.deps);
  assert.equal(ready.status, 'ready');
  const confirm = { ...opts, previewToken: ready.preview_token, previewExpires: ready.preview_expires, confirmText: 'SEND ONE KIT TO NEW TIMES' };
  const results = await Promise.allSettled([manualKitRecovery('confirm', request, confirm, h.deps), manualKitRecovery('confirm', request, confirm, h.deps)]);
  assert.equal(results.filter(r => r.status === 'fulfilled' && r.value.status === 'sent').length, 1);
  assert.equal(h.state.sends, 1); assert.equal(h.state.delivery, 'sent');
  h.state.evidence = payment('pi_month2', 80000);
  await assert.rejects(() => manualKitRecovery('preview', input('pi_month2', 'installment_entitlement'), opts, h.deps), /existing_order_or_delivery/);
  assert.equal(h.state.sends, 1);
});
test('existing hidden row, sent/reserved/uncertain delivery and ambiguous send fail closed', async () => {
  for (const prior of ['existing', 'sent', 'reserved', 'uncertain']) {
    const h = harness(); if (prior === 'existing') h.state.existing = true; else h.state.delivery = prior;
    await assert.rejects(() => manualKitRecovery('preview', input(), opts, h.deps), /existing_order_or_delivery/);
    assert.equal(h.state.sends, 0);
  }
  const h = harness(); const ready = await manualKitRecovery('preview', input(), opts, h.deps);
  h.deps.send = async () => { h.state.sends++; return { ok: false }; };
  const outcome = await manualKitRecovery('confirm', input(), { ...opts, previewToken: ready.preview_token,
    previewExpires: ready.preview_expires, confirmText: 'SEND ONE KIT TO NEW TIMES' }, h.deps);
  assert.equal(outcome.status, 'uncertain'); assert.equal(h.state.delivery, 'uncertain'); assert.equal(h.state.sends, 1);
});
test('refunds, disputes, unrelated products, partial without entitlement and stale evidence block', async () => {
  const cases = [
    [payment(), { ...order(), productIds: [] }],
    [{ ...payment(), payment: { ...payment().payment, refundedMinor: 1 } }, order()],
    [{ ...payment(), payment: { ...payment().payment, disputed: true } }, order()],
    [payment('pi_small', 80000), order()],
    [{ ...payment(), readAt: '2020-01-01T00:00:00Z' }, order()],
  ];
  for (const [e, g] of cases) {
    const h = harness(e, g); const result = await manualKitRecovery('preview', input(e.payment.id), opts, h.deps);
    assert.equal(result.status, 'blocked'); assert.equal(h.state.writes, 0); assert.equal(h.state.sends, 0);
  }
});
test('missing identity and non-admin roles never authorize kit actions', async () => {
  let roleReads = 0;
  const readUser = async token => token === 'valid' ? 'user-1' : null;
  const readAdmin = async () => { roleReads++; return false; };
  assert.equal((await authorizeKitAdmin(null, readUser, readAdmin)).status, 401);
  assert.equal((await authorizeKitAdmin('Bearer invalid', readUser, readAdmin)).status, 401);
  assert.equal(roleReads, 0);
  assert.equal((await authorizeKitAdmin('Bearer valid', readUser, readAdmin)).status, 403);
  assert.equal((await authorizeKitAdmin('Bearer valid', readUser, async () => true)).ok, true);
});
test('changed charge, stale preview and missing review phrase block before claim', async () => {
  const h = harness(); const ready = await manualKitRecovery('preview', input(), opts, h.deps);
  const confirm = { ...opts, previewToken: ready.preview_token, previewExpires: ready.preview_expires, confirmText: 'SEND ONE KIT TO NEW TIMES' };
  h.state.evidence = { ...payment(), payment: { ...payment().payment, chargeId: 'ch_changed' } };
  assert.equal((await manualKitRecovery('confirm', input(), confirm, h.deps)).reason, 'preview_changed_or_expired');
  h.state.evidence = payment();
  assert.equal((await manualKitRecovery('confirm', input(), { ...confirm, previewExpires: Date.now() - 1 }, h.deps)).reason, 'preview_changed_or_expired');
  assert.equal((await manualKitRecovery('confirm', input(), { ...confirm, confirmText: '' }, h.deps)).reason, 'preview_changed_or_expired');
  assert.equal(h.state.writes, 0); assert.equal(h.state.sends, 0);
});
test('unverified persisted delivery never reports a confirmed supplier send', async () => {
  const h = harness(); const ready = await manualKitRecovery('preview', input(), opts, h.deps);
  h.deps.verifyResult = async () => false;
  const result = await manualKitRecovery('confirm', input(), { ...opts, previewToken: ready.preview_token,
    previewExpires: ready.preview_expires, confirmText: 'SEND ONE KIT TO NEW TIMES' }, h.deps);
  assert.equal(result.status, 'uncertain'); assert.equal(result.reason, 'saved_result_unverified'); assert.equal(h.state.sends, 1);
});
