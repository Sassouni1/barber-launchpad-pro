import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { __setRelayFetch } from './barberLaunchGhlRelay.ts';
import { DEFAULT_SUPPLIER_EMAIL, buildAdminOrderSmsBody, dispatchSupplierOrderNotifications, sendSupplierEmail, type OrderRow } from './hairSystemNotifications.ts';

Deno.test('Chris order alert lists the selected system and shipping without payment details', () => {
  const order: OrderRow = {
    id: '11111111-2222-4333-8444-555555555555', customer_email: 'member@example.invalid', customer_name: 'Alex Member',
    order_details: {
      full_name: 'Alex Member', 'Client Name': 'Jordan Client', 'Choose Color': '1B',
      'Lace or Skin': 'Lace', 'Hair Length': '5 inches', 'Choose Density': '100% Standard',
      'Curl Pattern': 'Standard', shipping: { method: 'Rush Ship (3 Days) · $50', address_1: '1 Main St', city: 'Tampa', state: 'FL', zip: '33601' },
      notes: 'Please match the sample.', stripe_receipt: { amount: 30000 },
    },
  };
  const body = buildAdminOrderSmsBody(order);
  for (const expected of ['Member: Alex Member', 'Client: Jordan Client', 'Hair color: 1B', 'Base (lace or skin): Lace', 'Hair length: 5 inches', 'Density: 100% Standard', 'Curl pattern: Standard · 3.0 CM', 'Shipping: Rush Ship (3 Days)', 'Ship to: 1 Main St, Tampa, FL, 33601', 'Notes: Please match the sample.', `Order: ${order.id}`, `View: https://member.thebarberlaunch.com/newtimes?order=${order.id}`]) {
    assertEquals(body.includes(expected), true, expected);
  }
  assertEquals(body.includes('$50') || body.includes('30000'), false);
  assertEquals(body.length <= 1000, true);
  const longBody = buildAdminOrderSmsBody({ ...order, order_details: {
    ...order.order_details, notes: 'Long note '.repeat(300), 'Choose Color': 'Custom color '.repeat(20),
    shipping: { method: 'Rush Ship (3 Days) · $50', address_1: 'Long address '.repeat(30), city: 'Tampa', state: 'FL', zip: '33601' },
  } });
  assertEquals(longBody.length <= 1000, true);
  assertEquals(longBody.endsWith(`https://member.thebarberlaunch.com/newtimes?order=${order.id}`), true);
});

Deno.test('uncertain regular supplier send is held for manual review on retry', async () => {
  const priorKey = Deno.env.get('GHL_API_KEY');
  Deno.env.set('GHL_API_KEY', 'fixture-key');
  let sends = 0, claims = 0;
  __setRelayFetch((async () => { sends++; throw new Error('connection closed after request'); }) as typeof fetch);
  const saved: string[] = [];
  const db = {
    rpc: async () => ({ data: ++claims === 1 ? 'claimed' : 'manual_review', error: null }),
    from: () => ({ update: (row: { status: string }) => {
      saved.push(row.status);
      return { eq: () => ({ eq: async () => ({ error: null }) }) };
    } }),
  } as any;
  const order: OrderRow = { id: 'order-fixture', customer_email: 'buyer@example.com', customer_name: 'Fixture Buyer',
    order_details: { full_name: 'Fixture Buyer', shipping: { address_1: '1 Fixture St', city: 'City', state: 'FL', zip: '33764' } } };
  const buyer = { name: 'Fixture Buyer', email: 'buyer@example.com', phone: '+17275550100', address: ['1 Fixture St'] };
  try {
    assertEquals((await dispatchSupplierOrderNotifications(db, { orders: [order], buyer, eventId: 'evt_fixture' }))[0].result, 'uncertain');
    assertEquals((await dispatchSupplierOrderNotifications(db, { orders: [order], buyer, eventId: 'evt_fixture' }))[0].result, 'uncertain');
    assertEquals({ sends, saved }, { sends: 1, saved: ['uncertain'] });
  } finally {
    __setRelayFetch(fetch);
    if (priorKey === undefined) Deno.env.delete('GHL_API_KEY'); else Deno.env.set('GHL_API_KEY', priorKey);
  }
});

Deno.test('relay rejection before send remains retryable for regular supplier email', async () => {
  const priorKey = Deno.env.get('GHL_API_KEY');
  Deno.env.set('GHL_API_KEY', 'fixture-key');
  __setRelayFetch((async () => Response.json({ error: 'vlix_oauth_not_connected' }, { status: 503 })) as typeof fetch);
  try {
    const result = await sendSupplierEmail(null as any, { to: DEFAULT_SUPPLIER_EMAIL, subject: 'Fixture', html: '<p>Fixture</p>' });
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.safeRetry, true);
  } finally {
    __setRelayFetch(fetch);
    if (priorKey === undefined) Deno.env.delete('GHL_API_KEY'); else Deno.env.set('GHL_API_KEY', priorKey);
  }
});
