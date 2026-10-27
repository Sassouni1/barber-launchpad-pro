import assert from 'node:assert/strict';
import { test } from 'node:test';
import { manufacturerOrderView, highlightedOrderFromQuery } from './manufacturerOrderDetails.ts';

test('order query identifies the card to highlight', () => {
  assert.equal(highlightedOrderFromQuery('?order=ghl%2F123'), 'ghl/123');
  assert.equal(highlightedOrderFromQuery('?order='), '');
});

test('native paid order exposes all collected supplier fields, including modern density', () => {
  const view = manufacturerOrderView({ customerName: 'Barber', customerEmail: 'barber@example.com', orderDetails: {
    source: 'barber-launch-native-order-form', order_type: 'hair_system', full_name: 'Barber', phone: '+15551234567',
    shipping: { method: 'Rush Ship (3 Days) · $50', address_1: '123 Main', address_2: 'Unit 2', city: 'Miami', state: 'FL', zip: '33101' },
    notes: 'Leave at front desk', order_number: 2, total_orders: 3, 'Client Name': 'Private Client', 'Choose Color': '#2', 'Lace or Skin': 'Skin',
    'Hair Length': '14" hair', 'Choose Density': '90%', 'Curl Pattern': 'Standard',
    stripe_receipt: { total_minor: 299700, card_last4: '4242' },
  } });
  assert.deepEqual(view.items, ['Hair system']);
  assert.deepEqual(view.specs.map((s) => s.value).slice(0, 5), ['#2', 'Skin', '14" hair', '90%', 'Standard · 3.0 CM']);
  assert.equal(view.shippingMethod, 'Rush Ship (3 Days)');
  assert.deepEqual(view.shippingAddress, ['123 Main', 'Unit 2', 'Miami, FL', '33101']);
  assert.equal(view.notes, 'Leave at front desk');
  assert.equal(view.instruction, 'Please always choose NCON and HS1.');
  assert.equal(view.sequence, 'System 2 of 3');
  assert.ok(!JSON.stringify(view).includes('Private Client'));
  assert.ok(!JSON.stringify(view).includes('299700'));
  assert.ok(!JSON.stringify(view).includes('4242'));
});

test('legacy aliases are read; absent fields are disclosed without guessed defaults', () => {
  const view = manufacturerOrderView({ customerName: 'Barber', customerEmail: 'barber@example.com', orderDetails: {
    order: { line_items: [{ title: 'Hair System @ $200' }, { title: 'Shipping · $10' }] },
    'Choose Density if Needed (75%-110%) - 100% is regular': '110%',
    'Curl Pattern — only if needed': 'Extra straight',
  } });
  assert.deepEqual(view.items, ['Hair System']);
  assert.equal(view.shippingMethod, 'Shipping');
  assert.equal(view.specs.find((s) => s.label === 'Density')?.value, '110%');
  assert.equal(view.specs.find((s) => s.label === 'Curl pattern')?.value, 'Extra straight · 4.0 CM');
  assert.equal(view.specs.find((s) => s.label === 'Hair length')?.value, 'Not provided');
  assert.deepEqual(view.shippingAddress, []);
});

test('kit uses stored manifest and shipping without inventing individual specs', () => {
  const view = manufacturerOrderView({ customerName: 'Buyer', customerEmail: 'buyer@example.com', orderDetails: {
    kit_order: true, full_name: 'Buyer', shipping: { address_1: '456 Oak', city: 'Tampa', state: 'FL', zip: '33601', country: 'US' },
    order: { line_items: [{ title: '1 #2 skin system' }, { title: '1 #2 lace system' }, { title: 'color wheel' }, { title: 'adhesive' }, { title: 'tape' }, { title: 'C22 spray' }] },
  } });
  assert.deepEqual(view.items, ['1 #2 skin system', '1 #2 lace system', 'color wheel', 'adhesive', 'tape', 'C22 spray']);
  assert.deepEqual(view.specs, []);
  assert.equal(view.instruction, '');
  assert.deepEqual(view.shippingAddress, ['456 Oak', 'Tampa, FL', '33601 US']);
});

test('managed backend kit row displays its confirmed shipping and manifest', () => {
  const view = manufacturerOrderView({ customerName: 'Buyer', customerEmail: 'buyer@example.com', orderDetails: {
    supplier_kit: true, full_name: 'Buyer', phone: '7275550100',
    shipping_address: { name: 'Buyer', address1: '123 Main', address2: 'Unit 2', city: 'Tampa', state: 'FL', postal_code: '33601', country: 'US' },
    order: { line_items: [{ title: '1 #2 skin system', quantity: 1 }, { title: '1 #2 lace system', quantity: 1 }] },
  } });
  assert.equal(view.isKit, true);
  assert.deepEqual(view.items, ['1 #2 skin system', '1 #2 lace system']);
  assert.deepEqual(view.shippingAddress, ['123 Main', 'Unit 2', 'Tampa, FL', '33601 US']);
  assert.deepEqual(view.specs, []);
});
