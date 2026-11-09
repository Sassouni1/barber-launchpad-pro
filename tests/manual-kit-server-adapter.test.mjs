import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { KIT_ENROLLMENT_DESCRIPTION, KIT_2997_PRODUCT, KIT_LOCATION, KIT_STRIPE_APPLICATION } from '../supabase/functions/_shared/hairSystemKit/logic.ts';

const orderId = 'dddddddddddddddddddddddd';
const contactId = 'eeeeeeeeeeeeeeeeeeee';
const input = { order_id: orderId, payment_id: 'pi_adapter', contact_id: contactId,
  release_basis: 'fully_paid', shipping_confirmed: true, address_evidence: 'Owner confirmed the order shipping destination',
  reason: 'Paid enrollment missed the supplier kit queue',
  shipping: { name: 'Fixture Buyer', address1: '1 Fixture St', address2: '', city: 'Testville', state: 'NY', postal_code: '10001', country: 'US' } };
const payment = () => ({ readAt: new Date().toISOString(), order: { id: orderId, locationId: KIT_LOCATION,
  description: KIT_ENROLLMENT_DESCRIPTION, createdAt: new Date().toISOString(), paidAt: new Date().toISOString() },
  payment: { id: 'pi_adapter', orderId, locationId: KIT_LOCATION, contactId, application: KIT_STRIPE_APPLICATION,
    live: true, status: 'succeeded', currency: 'usd', receivedMinor: 299700, chargeId: 'ch_adapter',
    chargeStatus: 'succeeded', chargePaid: true, chargeCaptured: true, chargeAmountMinor: 299700, refundedMinor: 0, disputed: false },
  shipping: { name: '', address1: '', address2: '', city: '', state: '', postal_code: '', country: '' },
  contact: { email: '', phone: '' } });

let runManualKit;
async function loadAdapter() {
  if (runManualKit) return runManualKit;
  const stubs = {
    '../barberLaunchGhlRelay.ts': `export async function ghlOrderContact(){return {email:'fixture@example.com',phone:'+12125550100'}};
      export async function relayCall(){globalThis.__adapter.sends++;return {ok:true,messageId:'msg-adapter'}};`,
    '../hairSystemFulfillment.ts': `export function hairSystemStripeKey(){return 'fixture-key'};`,
    './readStripeEvidence.ts': `export async function readStripeEvidenceByPaymentIntent(){return structuredClone(globalThis.__adapter.payment)};`,
  };
  const bundled = await build({ entryPoints: ['supabase/functions/_shared/hairSystemKit/manualServer.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, plugins: [{ name: 'offline-provider-stubs', setup(esbuild) {
      esbuild.onResolve({ filter: /^(\.\.\/barberLaunchGhlRelay|\.\.\/hairSystemFulfillment|\.\/readStripeEvidence)\.ts$/ },
        args => ({ path: args.path, namespace: 'offline-stub' }));
      esbuild.onLoad({ filter: /.*/, namespace: 'offline-stub' }, args => ({ contents: stubs[args.path], loader: 'ts' }));
    } }] });
  ({ runManualKit } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`));
  return runManualKit;
}

function fakeDb(state) {
  const rows = table => table === 'orders' ? state.orders : table === 'hair_system_kit_deliveries' ? state.deliveries
    : table === 'hair_system_kit_manual_recoveries' ? state.claims : table === 'order_notifications' ? state.notifications : [];
  const db = { from(table) {
    const filters = [];
    let updating;
    const q = {
      select() { return q; }, eq(key, value) { filters.push([key, value]); state.queries.push({ table, key, value }); return q; },
      in(key, values) { filters.push([key, values]); state.queries.push({ table, key, value: values }); return q; },
      single() { return Promise.resolve(result(true)); }, maybeSingle() { return Promise.resolve(result(true)); },
      insert(value) { state.writes++; if (table === 'hair_system_kit_deliveries') state.deliveries.push({ id: 'delivery-1', status: 'reserved', message_id: null, ...value });
        else if (table === 'hair_system_kit_manual_recoveries') state.claims.push({ id: 'claim-1', status: 'reserved', supplier_message_id: null, ...value });
        return Promise.resolve({ error: null }); },
      upsert(value) { state.writes++; state.orders.push({ id: 'row-1', ...value }); return Promise.resolve({ error: null }); },
      update(value) { updating = value; return q; },
      then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject); },
    };
    function result(one) {
      if (table === 'app_settings') return { data: { value: false }, error: null };
      const matches = rows(table).filter(row => filters.every(([key, value]) =>
        Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
      if (updating) { state.writes++; for (const row of matches) Object.assign(row, updating); }
      return { data: one ? matches[0] ?? null : matches, error: null };
    }
    return q;
  } };
  return db;
}
function fixture() {
  const state = { payment: payment(), orders: [], deliveries: [], claims: [], notifications: [], writes: 0, sends: 0, queries: [], urls: [] };
  globalThis.__adapter = state;
  globalThis.Deno = { env: { get: key => ({ MANUAL_KIT_ALLOWED_ORDER_IDS: orderId, GHL_API_KEY: 'fixture-key' })[key] ?? null } };
  globalThis.fetch = async url => {
    state.urls.push(String(url));
    return Response.json({ _id: orderId, altId: KIT_LOCATION, contactId, status: 'completed',
      paymentStatus: 'paid', fulfillmentStatus: 'unfulfilled', updatedAt: '2026-11-09T00:00:00Z',
      items: [{ product: { _id: KIT_2997_PRODUCT } }] });
  };
  return { state, db: fakeDb(state) };
}

test('actual server adapter parses observed GHL order shape and queries exact records without preview writes', async () => {
  const run = await loadAdapter(); const { state, db } = fixture();
  const preview = await run(db, 'preview', input, { adminId: 'admin-fixture', secret: 'preview-secret' });
  assert.equal(preview.status, 'ready'); assert.equal(preview.facts.ghl_payment_status, 'paid');
  assert.equal(state.writes, 0); assert.equal(state.sends, 0);
  assert.ok(state.urls[0].includes(`/payments/orders/${orderId}?locationId=${KIT_LOCATION}&altType=location`));
  assert.ok(state.queries.some(q => q.table === 'orders' && q.key === 'external_order_id' && q.value === orderId));
  assert.ok(state.queries.some(q => q.table === 'orders' && q.key === 'payment_reference' && q.value === 'stripe:pi_adapter'));
  assert.ok(state.queries.some(q => q.table === 'hair_system_kit_deliveries' && q.key === 'ghl_order_id' && q.value === orderId));
});
test('actual server adapter makes permanent claim and confirms saved supplier message once', async () => {
  const run = await loadAdapter(); const { state, db } = fixture();
  const opts = { adminId: 'admin-fixture', secret: 'preview-secret' };
  const preview = await run(db, 'preview', input, opts);
  const result = await run(db, 'confirm', input, { ...opts, previewToken: preview.preview_token,
    previewExpires: preview.preview_expires, confirmText: 'SEND ONE KIT TO NEW TIMES' });
  assert.equal(result.status, 'sent'); assert.equal(result.supplier_message_id, 'msg-adapter');
  assert.equal(state.sends, 1); assert.equal(state.claims[0].status, 'sent'); assert.equal(state.deliveries[0].status, 'sent');
  assert.equal((await run(db, 'preview', input, opts)).reason, 'existing_manual_claim_requires_reconciliation');
  assert.equal(state.sends, 1);
});
test('adapter blocks hidden existing rows and all prior delivery outcomes', async () => {
  const run = await loadAdapter();
  for (const status of ['sent', 'reserved', 'uncertain']) {
    const { state, db } = fixture(); state.deliveries.push({ id: 'old', location_id: KIT_LOCATION, ghl_order_id: orderId, status });
    await assert.rejects(() => run(db, 'preview', input, { adminId: 'admin', secret: 'secret' }), /existing_supplier_delivery/);
    assert.equal(state.writes, 0); assert.equal(state.sends, 0);
  }
  const { state, db } = fixture(); state.orders.push({ id: 'hidden', external_order_id: orderId, status: 'pending', order_details: {} });
  await assert.rejects(() => run(db, 'preview', input, { adminId: 'admin', secret: 'secret' }), /existing_order_requires_reconciliation/);
  assert.ok(state.queries.some(q => q.table === 'order_notifications'));
});
test('manual claim migration is discoverable in Drizzle journal', async () => {
  const journal = JSON.parse(await readFile('drizzle/migrations/meta/_journal.json', 'utf8'));
  const last = journal.entries.at(-1);
  assert.equal(last.idx, 9); assert.equal(last.tag, '0009_manual_kit_recovery_claims');
  assert.match(await readFile('drizzle/migrations/0009_manual_kit_recovery_claims.sql', 'utf8'), /CREATE TABLE public\.hair_system_kit_manual_recoveries/);
});
