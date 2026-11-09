import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { publicOrderDetails } from '../supabase/functions/newtimes-orders/projection.ts';

const request = () => ({ request_key: '33333333-3333-4333-8333-333333333333', name: 'Fixture Buyer',
  email: 'fixture@example.com', phone: '+12125550100', shipping: {
    address1: '1 Fixture St', address2: '', city: 'Testville', state: 'NY', postal_code: '10001', country: 'US' },
  kit_notes: 'Use the included color wheel', reason: '', address_evidence: '', shipping_confirmed: true });
let runManualKit;
async function loadAdapter() {
  if (runManualKit) return runManualKit;
  const bundled = await build({ entryPoints: ['supabase/functions/_shared/hairSystemKit/manualServer.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, plugins: [{ name: 'offline-relay', setup(esbuild) {
      esbuild.onResolve({ filter: /^\.\.\/barberLaunchGhlRelay\.ts$/ }, () => ({ path: 'relay', namespace: 'offline-stub' }));
      esbuild.onLoad({ filter: /.*/, namespace: 'offline-stub' }, () => ({ contents:
        `export async function relayCall(action,payload){globalThis.__manualAdapter.sends++;globalThis.__manualAdapter.email=payload;return {ok:true,messageId:'msg-adapter'}};`, loader: 'ts' }));
    } }] });
  ({ runManualKit } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`));
  return runManualKit;
}
function reorder(value) {
  if (Array.isArray(value)) return value.map(reorder);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([k,v]) => [k, reorder(v)]));
  return value;
}
function fixture() {
  const state = { orders: [], deliveries: [], claims: [], writes: 0, sends: 0, email: null, duplicateReads: 0,
    duplicateUnavailable: false, queries: [] };
  globalThis.__manualAdapter = state;
  globalThis.Deno = { env: { get: () => null } };
  globalThis.fetch = async () => { throw Error('No provider read is allowed for manual entry'); };
  const db = {
    rpc: async (name, args) => {
      assert.equal(name, 'manual_kit_duplicate_state'); state.duplicateReads++;
      state.queries.push({ name, args });
      if (state.duplicateUnavailable) return { data: null, error: { message: 'read failed' } };
      const matches = state.orders.filter(o => {
        const d = o.order_details ?? {};
        return (d.supplier_kit === true || d.kit_order === true) &&
          (o.customer_email?.trim().toLowerCase() === args._email.trim().toLowerCase() ||
           String(d.phone ?? '').replace(/\D/g, '') === args._phone.replace(/\D/g, '') ||
           o.external_order_id === `manual-kit:${args._request_key}`);
      });
      const claims = state.claims.filter(c => c.request_key !== args._request_key &&
        (c.preview_facts.email.trim().toLowerCase() === args._email.trim().toLowerCase() ||
         c.preview_facts.phone.replace(/\D/g, '') === args._phone.replace(/\D/g, '')));
      return { data: { matching_orders: matches.length, manual_claims: claims.length,
        supplier_notifications: 0, delivery_records: 0 }, error: null };
    },
    from(table) {
      const filters = []; let mutation = null;
      const list = () => table === 'orders' ? state.orders : table === 'hair_system_kit_deliveries' ? state.deliveries
        : table === 'hair_system_kit_manual_recoveries' ? state.claims : [];
      const q = {
        select() { return q; },
        eq(key, value) { filters.push([key, value]); state.queries.push({ table, key, value }); return q; },
        insert(value) { mutation = { type: 'insert', value }; return q; },
        update(value) { mutation = { type: 'update', value }; return q; },
        maybeSingle() { return Promise.resolve(result(true)); },
        single() { return Promise.resolve(result(true)); },
        then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject); },
      };
      function result(one) {
        if (table === 'app_settings') return { data: { value: false }, error: null };
        if (mutation?.type === 'insert') {
          state.writes++; const entry = { id: `${table}-row`, status: 'reserved', ...mutation.value };
          if (table === 'orders') entry.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
          list().push(entry); return { data: one ? entry : [entry], error: null };
        }
        const matches = list().filter(row => filters.every(([key, value]) => row[key] === value));
        if (mutation?.type === 'update') { state.writes++; matches.forEach(row => Object.assign(row, mutation.value)); }
        const found = one ? matches[0] ?? null : matches;
        if (table === 'orders' && one && found) return { data: { ...found, order_details: reorder(found.order_details) }, error: null };
        return { data: found, error: null };
      }
      return q;
    },
  };
  return { state, db };
}
test('adapter preview reads complete duplicate state with no provider calls or writes', async () => {
  const run = await loadAdapter(); const { state, db } = fixture();
  const preview = await run(db, 'preview', request(), { adminId: 'admin-fixture', secret: 'fixture-secret' });
  assert.equal(preview.status, 'ready'); assert.equal(state.writes, 0); assert.equal(state.sends, 0);
  assert.equal(state.duplicateReads, 1);
  assert.equal(state.queries.find(q => q.name === 'manual_kit_duplicate_state').args._email, request().email);
});
test('adapter saves and verifies reordered jsonb, projects entered notes, and sends exact row link once', async () => {
  const run = await loadAdapter(); const { state, db } = fixture(); const opts = { adminId: 'admin-fixture', secret: 'fixture-secret' };
  const preview = await run(db, 'preview', request(), opts);
  const result = await run(db, 'confirm', request(), { ...opts, previewToken: preview.preview_token, previewExpires: preview.preview_expires });
  assert.equal(result.status, 'sent'); assert.equal(state.sends, 1);
  assert.match(state.email.html, /newtimes\?order=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
  assert.equal(state.claims[0].status, 'sent'); assert.equal(state.deliveries[0].status, 'sent');
  const projection = publicOrderDetails(state.orders[0].order_details);
  assert.equal(projection.notes, request().kit_notes);
  assert.equal(projection.supplier_kit, true);
  assert.deepEqual(projection.shipping_address, { name: request().name, ...request().shipping });
  assert.equal('manual_facts' in projection, false); assert.equal('address_evidence' in projection, false);
  assert.equal((await run(db, 'preview', request(), opts)).reason, 'prior_manual_claim_requires_reconciliation');
});
test('different browser UUID, prior claim, legacy kit, prior delivery, or unavailable duplicate read block', async () => {
  const run = await loadAdapter();
  for (const kind of ['manual', 'claim', 'legacy', 'delivery', 'unavailable']) {
    const { state, db } = fixture();
    if (kind === 'manual') state.orders.push({ customer_email: request().email, order_details: { supplier_kit: true } });
    if (kind === 'legacy') state.orders.push({ customer_email: request().email, order_details: { kit_order: true } });
    if (kind === 'claim') state.claims.push({ request_key: '22222222-2222-4222-8222-222222222222',
      identity_key: 'different-phone', preview_facts: { email: request().email, phone: '9999999999' }, status: 'uncertain' });
    if (kind === 'delivery') state.deliveries.push({ location_id: 'JVBUuL3dVwZahuGay9T1',
      entitlement_key: createHash('sha256').update('fixture@example.com\n12125550100').digest('hex'), status: 'uncertain' });
    if (kind === 'unavailable') state.duplicateUnavailable = true;
    await assert.rejects(() => run(db, 'preview', request(), { adminId: 'admin', secret: 'secret' }), /existing_kit_requires_reconciliation|existing_delivery_requires_reconciliation|duplicate_state_unavailable/);
    assert.equal(state.writes, 0); assert.equal(state.sends, 0);
  }
});
test('migration journal includes the manual claim and database protection', async () => {
  const journal = JSON.parse(await readFile('drizzle/migrations/meta/_journal.json', 'utf8'));
  assert.equal(journal.entries.at(-1).tag, '0009_manual_kit_recovery_claims');
  const sql = await readFile('drizzle/migrations/0009_manual_kit_recovery_claims.sql', 'utf8');
  assert.match(sql, /protect_manual_kit_facts_before_write/);
  assert.match(sql, /supplier_kit' IS DISTINCT/);
});
