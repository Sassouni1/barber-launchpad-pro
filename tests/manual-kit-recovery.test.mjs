import test from 'node:test';
import assert from 'node:assert/strict';
import { manualKitRecovery } from '../supabase/functions/_shared/hairSystemKit/manualRecovery.ts';
import { authorizeKitAdmin, canonicalJson, manualKitEmail, manualOrderRow } from '../supabase/functions/_shared/hairSystemKit/manual.ts';
import { KIT_ITEMS } from '../supabase/functions/_shared/hairSystemKit/logic.ts';

const input = (request_key = '11111111-1111-4111-8111-111111111111') => ({
  request_key, name: ' Fixture Buyer ', email: 'Fixture@Example.com', phone: '+1 (212) 555-0100',
  shipping: { address1: '1 Fixture St', address2: '', city: 'Testville', state: 'NY', postal_code: '10001', country: 'US' },
  kit_notes: 'One unit to trim later', reason: '', address_evidence: '', shipping_confirmed: true,
});
const opts = { adminId: 'admin-fixture', secret: 'long-preview-secret-for-fixture' };
function harness() {
  const state = { claims: new Set(), orders: new Set(), delivery: null, sends: 0, writes: 0, mail: null, existing: false };
  const deps = {
    checkClaim: async identity => state.claims.has(identity),
    checkExisting: async () => { if (state.existing || state.orders.size || state.delivery) throw Error('existing_kit_requires_reconciliation'); },
    claim: async facts => { if (state.claims.has(facts.identity_key)) return false; state.claims.add(facts.identity_key); state.writes++; return true; },
    createRow: async row => { state.orders.add(row.external_order_id); state.writes++; return 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; },
    verifyVisible: async () => true,
    reserveDelivery: async () => { if (state.delivery) return false; state.delivery = 'reserved'; state.writes++; return true; },
    send: async mail => { state.mail = mail; state.sends++; return { ok: true, messageId: 'msg-fixture' }; },
    finishDelivery: async (_identity, status) => { state.delivery = status; state.writes++; },
    finishClaim: async () => { state.writes++; },
    verifyResult: async () => true,
  };
  return { state, deps };
}
test('simple preview uses entered facts exactly, fixed kit, and makes no writes', async () => {
  const h = harness(); const request = input();
  const preview = await manualKitRecovery('preview', request, opts, h.deps);
  assert.equal(preview.status, 'ready'); assert.equal(h.state.writes, 0); assert.equal(h.state.sends, 0);
  assert.equal(preview.facts.name, request.name); assert.equal(preview.facts.email, request.email);
  assert.deepEqual(preview.facts.kit_items, KIT_ITEMS);
  const row = manualOrderRow(request, opts.adminId, preview.facts.identity_key);
  assert.equal(row.order_details.manual_source, 'admin_entry');
  assert.equal(row.order_details.notes, request.kit_notes);
  assert.equal(row.customer_name, request.name);
  assert.equal(row.payment_reference, null);
});
test('endpoint-shaped preview and confirmation bodies bind only entered facts', async () => {
  const h = harness();
  const previewBody = { ...input(), action: 'manual_preview' };
  const preview = await manualKitRecovery('preview', previewBody, opts, h.deps);
  assert.equal(preview.status, 'ready');
  assert.equal('action' in preview.facts, false);
  const confirmationBody = { ...input(), action: 'manual_confirm', preview_token: preview.preview_token,
    preview_expires: preview.preview_expires };
  const result = await manualKitRecovery('confirm', confirmationBody, { ...opts,
    previewToken: confirmationBody.preview_token, previewExpires: confirmationBody.preview_expires }, h.deps);
  assert.equal(result.status, 'sent');
  assert.equal(h.state.sends, 1);
});
test('confirm sends once; refresh with a new request UUID for the same buyer cannot make another kit', async () => {
  const h = harness(); const preview = await manualKitRecovery('preview', input(), opts, h.deps);
  const confirm = { ...opts, previewToken: preview.preview_token, previewExpires: preview.preview_expires };
  const results = await Promise.all([manualKitRecovery('confirm', input(), confirm, h.deps),
    manualKitRecovery('confirm', input(), confirm, h.deps)]);
  assert.equal(results.filter(r => r.status === 'sent').length, 1);
  assert.equal(h.state.sends, 1); assert.equal(h.state.delivery, 'sent');
  const refreshed = await manualKitRecovery('preview', input('22222222-2222-4222-8222-222222222222'), opts, h.deps);
  assert.equal(refreshed.reason, 'prior_manual_claim_requires_reconciliation');
  assert.equal(h.state.sends, 1);
});
test('changed address/admin, expired preview, and existing supplier state block before another send', async () => {
  const h = harness(); const preview = await manualKitRecovery('preview', input(), opts, h.deps);
  const confirm = { ...opts, previewToken: preview.preview_token, previewExpires: preview.preview_expires };
  const changed = { ...input(), shipping: { ...input().shipping, address1: '2 Fixture St' } };
  assert.equal((await manualKitRecovery('confirm', changed, confirm, h.deps)).reason, 'preview_changed_or_expired');
  assert.equal((await manualKitRecovery('confirm', input(), { ...confirm, adminId: 'another-admin' }, h.deps)).reason, 'preview_changed_or_expired');
  assert.equal((await manualKitRecovery('confirm', input(), { ...confirm, previewExpires: Date.now() - 1 }, h.deps)).reason, 'preview_changed_or_expired');
  h.state.existing = true;
  await assert.rejects(() => manualKitRecovery('preview', input(), opts, h.deps), /existing_kit_requires_reconciliation/);
  assert.equal(h.state.writes, 0); assert.equal(h.state.sends, 0);
});
test('unknown relay outcome stays terminal; supplier link uses actual saved row UUID', async () => {
  const h = harness(); const preview = await manualKitRecovery('preview', input(), opts, h.deps);
  h.deps.send = async mail => { h.state.mail = mail; h.state.sends++; return { ok: false }; };
  const result = await manualKitRecovery('confirm', input(), { ...opts, previewToken: preview.preview_token,
    previewExpires: preview.preview_expires }, h.deps);
  assert.equal(result.status, 'uncertain'); assert.equal(h.state.delivery, 'uncertain');
  assert.equal(h.state.sends, 1);
  assert.match(h.state.mail.html, /newtimes\?order=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
  assert.equal((await manualKitRecovery('preview', input(), opts, h.deps)).reason, 'prior_manual_claim_requires_reconciliation');
  assert.equal(manualKitEmail(input(), 'row-123').html.includes('order=row-123'), true);
});
test('authorization and order-independent jsonb comparisons', async () => {
  let roleReads = 0;
  const readUser = async token => token === 'valid' ? 'admin-1' : null;
  assert.equal((await authorizeKitAdmin(null, readUser, async () => true)).status, 401);
  assert.equal((await authorizeKitAdmin('Bearer invalid', readUser, async () => true)).status, 401);
  assert.equal((await authorizeKitAdmin('Bearer valid', readUser, async () => { roleReads++; return false; })).status, 403);
  assert.equal((await authorizeKitAdmin('Bearer valid', readUser, async () => true)).ok, true);
  assert.equal(roleReads, 1);
  assert.equal(canonicalJson({ b: 2, a: { z: 1, x: 0 } }), canonicalJson({ a: { x: 0, z: 1 }, b: 2 }));
});
