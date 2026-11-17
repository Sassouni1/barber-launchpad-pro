import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { supplierPriceFor } from '../src/lib/supplierPrice.ts';
import { publicOrderDetails } from '../supabase/functions/newtimes-orders/projection.ts';

let module;
async function code() {
  if (module) return module;
  const bundled = await build({ entryPoints: ['supabase/functions/_shared/hairSystemKit/manualIndividualRecovery.ts'],
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'offline-transport', setup(esbuild) {
      esbuild.onResolve({ filter: /(?:ghlMessaging|barberLaunchGhlRelay)\.ts$/ }, args => ({ path: args.path, namespace: 'offline' }));
      esbuild.onLoad({ filter: /.*/, namespace: 'offline' }, args => ({ loader: 'ts', contents: args.path.includes('ghlMessaging')
        ? 'export const normalizePhone = value => value;'
        : 'export const relayCall = async () => { throw Error("Live send forbidden in test") }; export const relayDefinitelyDidNotSend = () => false;' }));
    } }] });
  module = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  return module;
}
const request = (name = 'Example Salon', variant = '#2 FRO skin unit', request_key = '11111111-1111-4111-8111-111111111111') => ({
  request_key, name, email: '', phone: '', shipping: { address1: `${name.length} Test St`, address2: '',
    city: 'Testville', state: 'NY', postal_code: '10001', country: 'US' },
  item: 'Skin hair system', variant, quantity: 1, supplier_cost_cents: null, notes: '',
  shipping_confirmed: true, repeat_of_order_id: null, repeat_confirmed: false,
});
function harness() {
  const state = { claims: new Set(), rows: [], deliveries: new Set(), sends: [], existing: false };
  const deps = {
    checkExisting: async input => { if (state.existing || state.rows.some(r => r.order_details.manual_facts.name === input.name &&
      r.order_details.manual_facts.variant === input.variant && !input.repeat_of_order_id)) throw Error('existing_individual_requires_reconciliation'); },
    claim: async facts => { const key = `${facts.fingerprint}:${facts.repeat_of_order_id ?? 'first'}`;
      if (state.claims.has(key)) return false; state.claims.add(key); return true; },
    createRow: async row => { const id = state.rows.length === 0 ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      state.rows.push({ ...row, id }); return id; },
    verifyVisible: async () => true,
    reserveDelivery: async key => { if (state.deliveries.has(key)) return false; state.deliveries.add(key); return true; },
    send: async mail => { state.sends.push(mail); return { ok: true, messageId: `msg-${state.sends.length}` }; },
    finishDelivery: async () => {}, finishClaim: async () => {}, verifyResult: async () => true,
  };
  return { state, deps };
}
const opts = { adminId: 'admin-test', secret: 'test-secret' };
async function submit(run, input, deps) {
  const preview = await run('preview', { ...input, action: 'individual_preview' }, opts, deps);
  assert.equal(preview.status, 'ready');
  return run('confirm', { ...input, action: 'individual_confirm', preview_token: preview.preview_token,
    preview_expires: preview.preview_expires }, { ...opts, previewToken: preview.preview_token,
    previewExpires: preview.preview_expires }, deps);
}
test('three requested example variants survive row, projection and normal supplier email with synthetic addresses', async () => {
  const { individualRow, individualEmail, individualFingerprint } = await code();
  for (const [name, variant] of [
    ['Celeste Salon (Hair M)', '#2 skin system'],
    ['Zenda Gibson', '#2 FRO skin unit'],
    ['Monk the Barber (Sthreyviolerchk Ma)', 'dark black skin unit'],
  ]) {
    const input = request(name, variant);
    const row = individualRow(input, opts.adminId, await individualFingerprint(input));
    assert.equal(row.status, 'pending'); assert.equal(row.payment_reference, null);
    assert.equal(row.order_details.supplier_kit, false);
    assert.equal(row.order_details.order.line_items.length, 1);
    assert.equal(row.order_details['Choose Color'], variant);
    assert.equal(row.order_details.order.line_items[0].title, `Skin hair system — ${variant}`);
    const projected = publicOrderDetails(row.order_details);
    assert.equal(projected.line_items[0].title, `Skin hair system — ${variant}`);
    assert.deepEqual(supplierPriceFor(projected), { kind: 'review', amount: null, label: 'Cost unknown' });
    const mail = individualEmail(input, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.equal(mail.subject, 'New Hair System Order');
    assert.match(mail.html, /newtimes\?order=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
    assert.ok(mail.html.includes(variant.replace('&', '&amp;')));
  }
});
test('preview writes nothing; two distinct recipients send once to their own order links', async () => {
  const { manualIndividualRecovery } = await code(); const { state, deps } = harness();
  const a = request('Example Salon', '#2 skin unit');
  const b = request('Other Barber', 'dark black skin unit', '22222222-2222-4222-8222-222222222222');
  const preview = await manualIndividualRecovery('preview', a, opts, deps);
  assert.equal(preview.status, 'ready'); assert.equal(state.rows.length, 0); assert.equal(state.sends.length, 0);
  assert.equal((await submit(manualIndividualRecovery, a, deps)).status, 'sent');
  assert.equal((await submit(manualIndividualRecovery, b, deps)).status, 'sent');
  assert.match(state.sends[0].html, /order=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
  assert.match(state.sends[1].html, /order=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/);
  assert.equal(state.sends.length, 2);
});
test('concurrent duplicate, fresh UUID retry, changed preview, and uncertain send stay safe', async () => {
  const { manualIndividualRecovery } = await code(); const { state, deps } = harness(); const input = request();
  const preview = await manualIndividualRecovery('preview', input, opts, deps);
  const confirm = { ...opts, previewToken: preview.preview_token, previewExpires: preview.preview_expires };
  const results = await Promise.all([manualIndividualRecovery('confirm', input, confirm, deps),
    manualIndividualRecovery('confirm', input, confirm, deps)]);
  assert.equal(results.filter(r => r.status === 'sent').length, 1); assert.equal(state.sends.length, 1);
  await assert.rejects(() => manualIndividualRecovery('preview', request('Example Salon', '#2 FRO skin unit',
    '33333333-3333-4333-8333-333333333333'), opts, deps), /existing_individual/);
  const other = request('Different Buyer', 'dark black', '44444444-4444-4444-8444-444444444444');
  const p = await manualIndividualRecovery('preview', other, opts, deps);
  assert.equal((await manualIndividualRecovery('confirm', { ...other, variant: '#2 FRO' },
    { ...opts, previewToken: p.preview_token, previewExpires: p.preview_expires }, deps)).reason, 'preview_changed_or_expired');
  deps.send = async mail => { state.sends.push(mail); return { ok: false }; };
  assert.equal((await submit(manualIndividualRecovery, other, deps)).status, 'uncertain');
  assert.equal(state.sends.length, 2);
  await assert.rejects(() => manualIndividualRecovery('preview', { ...other,
    request_key: '55555555-5555-4555-8555-555555555555' }, opts, deps), /existing_individual/);
  assert.equal(state.sends.length, 2);
});
test('a deliberate later repeat is distinct from a retry, with the prior order explicitly named', async () => {
  const { manualIndividualRecovery } = await code(); const { state, deps } = harness();
  const original = request();
  assert.equal((await submit(manualIndividualRecovery, original, deps)).status, 'sent');
  const repeat = { ...original, request_key: '66666666-6666-4666-8666-666666666666',
    repeat_of_order_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat_confirmed: true };
  assert.equal((await submit(manualIndividualRecovery, repeat, deps)).status, 'sent');
  assert.equal(state.sends.length, 2);
  const retry = { ...repeat, request_key: '77777777-7777-4777-8777-777777777777' };
  assert.equal((await submit(manualIndividualRecovery, retry, deps)).reason,
    'prior_individual_claim_requires_reconciliation');
  assert.equal(state.sends.length, 2);
});
test('optional cost is explicit and validation rejects unconfirmed or invented details', async () => {
  const { validateIndividual, individualRow, individualFingerprint } = await code();
  const input = request();
  assert.equal(validateIndividual(input), null);
  assert.equal(validateIndividual({ ...input, quantity: 2 }), 'individual_details_invalid');
  assert.equal(validateIndividual({ ...input, item: 'Lace hair system' }), 'individual_details_invalid');
  assert.equal(validateIndividual({ ...input, shipping_confirmed: false }), 'confirmation_missing');
  assert.equal(validateIndividual({ ...input, email: 'bad' }), 'customer_details_invalid');
  const withCost = { ...input, supplier_cost_cents: 17500 };
  const row = individualRow(withCost, opts.adminId, await individualFingerprint(withCost));
  assert.equal(supplierPriceFor(publicOrderDetails(row.order_details)).amount, 175);
});
