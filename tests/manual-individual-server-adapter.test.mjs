import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { authorizeKitAdmin } from '../supabase/functions/_shared/hairSystemKit/manual.ts';

const input = () => ({ request_key: '11111111-1111-4111-8111-111111111111', name: 'Synthetic Buyer',
  email: '', phone: '', shipping: { address1: '1 Test St', address2: '', city: 'Testville', state: 'NY', postal_code: '10001', country: 'US' },
  item: 'Skin hair system', variant: '#2 FRO skin unit', quantity: 1, supplier_cost_cents: null,
  notes: '', shipping_confirmed: true, repeat_of_order_id: null, repeat_confirmed: false });
let run;
async function load() {
  if (run) return run;
  const bundle = await build({ entryPoints: ['supabase/functions/_shared/hairSystemKit/manualIndividualServer.ts'],
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'offline', setup(esbuild) {
      esbuild.onResolve({ filter: /(?:ghlMessaging|barberLaunchGhlRelay)\.ts$/ }, args => ({ path: args.path, namespace: 'offline' }));
      esbuild.onLoad({ filter: /.*/, namespace: 'offline' }, args => ({ loader: 'ts', contents: args.path.includes('ghlMessaging')
        ? 'export const normalizePhone = value => value;'
        : 'export const relayCall = async (_action, payload) => {globalThis.__individualState.sends.push(payload);return {ok:true,messageId:"msg-test"}}; export const relayDefinitelyDidNotSend = () => false;' }));
    } }] });
  ({ runManualIndividual: run } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`));
  return run;
}
function fixture() {
  const state = { hold: false, rpcError: false, writes: 0, sends: [], claims: [], orders: [], deliveries: [], rpcCalls: 0 };
  globalThis.__individualState = state;
  const db = {
    rpc: async (name, args) => {
      assert.equal(name, 'manual_individual_duplicate_state'); state.rpcCalls++;
      assert.equal(args._variant, '#2 FRO skin unit');
      if (state.rpcError) return { data: null, error: { message: 'unreadable' } };
      return { data: { parent_valid: true, prior_orders: 0, external_orders: 0,
        matching_claims: 0, matching_deliveries: 0, matching_notifications: 0 }, error: null };
    },
    from(table) {
      const filters = []; let mutation = null;
      const entries = () => table === 'orders' ? state.orders : table === 'hair_system_kit_deliveries' ? state.deliveries : state.claims;
      const query = {
        select() { return query; }, eq(k,v) { filters.push([k,v]); return query; },
        is(k,v) { filters.push([k,v]); return query; },
        insert(v) { mutation = { type:'insert', value:v }; return query; },
        update(v) { mutation = { type:'update', value:v }; return query; },
        maybeSingle() { return Promise.resolve(result(true)); }, single() { return Promise.resolve(result(true)); },
        then(resolve,reject) { return Promise.resolve(result(false)).then(resolve,reject); },
      };
      function result(one) {
        if (table === 'app_settings') return { data: { value: state.hold }, error: null };
        if (mutation?.type === 'insert') {
          state.writes++;
          const row = { id: table === 'orders' ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : `${table}-id`, status:'reserved', ...mutation.value };
          entries().push(row); return { data: one ? row : [row], error: null };
        }
        const found = entries().filter(row => filters.every(([k,v]) => row[k] === v));
        if (mutation?.type === 'update') { state.writes++; found.forEach(row => Object.assign(row, mutation.value)); }
        return { data: one ? found[0] ?? null : found, error: null };
      }
      return query;
    },
  };
  return { state, db };
}
test('admin authorization rejects missing and non-admin sessions', async () => {
  assert.equal((await authorizeKitAdmin(null, async () => 'admin', async () => true)).status, 401);
  assert.equal((await authorizeKitAdmin('Bearer token', async () => 'user', async () => false)).status, 403);
  assert.equal((await authorizeKitAdmin('Bearer token', async () => 'admin', async () => true)).ok, true);
});
test('adapter preview is read-only, confirmation verifies row and delivery, then sends once', async () => {
  const run = await load(); const { state, db } = fixture(); const opts = { adminId: 'admin-id', secret: 'secret' };
  const preview = await run(db, 'preview', input(), opts);
  assert.equal(preview.status, 'ready'); assert.equal(state.writes, 0); assert.equal(state.sends.length, 0);
  const outcome = await run(db, 'confirm', input(), { ...opts, previewToken: preview.preview_token, previewExpires: preview.preview_expires });
  assert.equal(outcome.status, 'sent'); assert.equal(state.sends.length, 1);
  assert.equal(state.orders[0].status, 'pending'); assert.equal(state.orders[0].order_details.supplier_kit, false);
  assert.equal(state.claims[0].status, 'sent'); assert.equal(state.deliveries[0].status, 'sent');
  assert.equal(state.sends[0].subject, 'New Hair System Order');
  assert.match(state.sends[0].html, /order=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
});
test('real hold and unreadable duplicate state block without writes or sends', async () => {
  const run = await load(); const { state, db } = fixture(); const opts = { adminId: 'admin-id', secret: 'secret' };
  state.hold = true;
  assert.equal((await run(db, 'preview', input(), opts)).reason, 'fulfillment_held');
  state.hold = false; state.rpcError = true;
  await assert.rejects(() => run(db, 'preview', input(), opts), /duplicate_state_unavailable/);
  assert.equal(state.writes, 0); assert.equal(state.sends.length, 0);
});
