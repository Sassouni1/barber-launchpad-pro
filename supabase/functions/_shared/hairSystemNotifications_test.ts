import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { __setRelayFetch } from './barberLaunchGhlRelay.ts';
import { DEFAULT_SUPPLIER_EMAIL, dispatchSupplierOrderNotifications, sendSupplierEmail, type OrderRow } from './hairSystemNotifications.ts';

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
