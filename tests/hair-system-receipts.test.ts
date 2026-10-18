import { describe, expect, test } from 'bun:test';
import { receiptAccessAllowed, stripeReceiptSnapshot, verifyReceiptOrder } from '../supabase/functions/_shared/hairSystemReceipt';
import { consolidateNativeOrders, withNativeReceipt, currencyMinorDivisor } from '../src/lib/nativeOrderReceipt';
import { extractReceiptData, buildReceiptPdf } from '../src/lib/orderReceipt';
import type { Tables } from '../src/integrations/supabase/types';

const session = { id: 'cs_live_fixture', object: 'checkout.session', payment_status: 'paid', created: 1791936000, currency: 'usd', amount_total: 21000, metadata: { user_id: 'owner', draft_id: 'draft' }, line_items: { has_more: false, data: [
  { description: 'Standard Men’s System (5 inch)', quantity: 1, amount_total: 20000, currency: 'usd' },
  { description: 'Shipping', quantity: 1, amount_total: 1000, currency: 'usd' },
] } };
const order = { id: 'order-1', user_id: 'owner', status: 'pending', checkout_draft_id: 'draft', system_index: 0, payment_reference: 'stripe:cs_live_fixture:0', stripe_checkout_session_id: session.id, order_date: '2026-10-14T00:00:00Z', customer_name: 'Fixture', order_details: { 'Lace or Skin': 'Lace', 'Choose Color': '#18' } } as unknown as Tables<'orders'>;

describe('paid native checkout receipts', () => {
  test('Stripe fixture supplies $200 system, $10 shipping and $210 total without a price fallback', () => {
    const receipt = stripeReceiptSnapshot(session);
    const data = extractReceiptData(withNativeReceipt(order, { receipt, orders: [order] }));
    expect(data.total).toBe(210);
    expect(data.currencyCode).toBe('USD');
    expect(data.items.map((item) => [item.unitPrice, item.lineTotal])).toEqual([[200, 200], [10, 10]]);
    expect(buildReceiptPdf(withNativeReceipt(order, { receipt, orders: [order] })).output()).toContain('($210.00 USD)');
  });
  test('missing Stripe amount stays unavailable and cannot create a blank PDF', () => {
    expect(extractReceiptData(order).total).toBeNull();
    expect(() => buildReceiptPdf(order)).toThrow('Paid amount unavailable');
    expect(() => stripeReceiptSnapshot({ ...session, amount_total: undefined })).toThrow();
    expect(() => stripeReceiptSnapshot({ ...session, line_items: { data: [] } })).toThrow();
  });
  test('multiple systems have one consolidated checkout and one shipping charge', () => {
    const second = { ...order, id: 'order-2', system_index: 1 };
    expect(consolidateNativeOrders([order, second]).map((o) => o.id)).toEqual(['order-1']);
    const multi = { ...session, amount_total: 41000, line_items: { data: [{ ...session.line_items.data[0], quantity: 2, amount_total: 40000 }, session.line_items.data[1]] } };
    const data = extractReceiptData(withNativeReceipt(order, { receipt: stripeReceiptSnapshot(multi), orders: [order, second] }));
    expect(data.total).toBe(410);
    expect(data.items[0].quantity).toBe(2);
    expect(data.items[0].unitPrice).toBe(200);
    expect(data.items[1].lineTotal).toBe(10);
  });
  test('owner and server-authorized admin only; unrelated users are denied', () => {
    expect(receiptAccessAllowed('owner', false, 'owner')).toBe(true);
    expect(receiptAccessAllowed('other', false, 'owner')).toBe(false);
    expect(receiptAccessAllowed('admin', true, 'owner')).toBe(true);
    expect(receiptAccessAllowed('other', false, null)).toBe(false);
  });
  test('paid/session/user/draft/reference verification rejects forged associations', () => {
    expect(() => verifyReceiptOrder(order, session)).not.toThrow();
    for (const patch of [{ payment_status: 'unpaid' }, { id: 'cs_live_wrong' }, { metadata: { ...session.metadata, user_id: 'other' } }, { metadata: { ...session.metadata, draft_id: 'other' } }]) expect(() => verifyReceiptOrder(order, { ...session, ...patch })).toThrow();
    expect(() => verifyReceiptOrder({ ...order, status: 'pending_payment' }, session)).toThrow();
    expect(() => verifyReceiptOrder({ ...order, payment_reference: 'wrong' }, session)).toThrow();
  });
  test('truncated and inconsistent Stripe line items fail closed', () => {
    expect(() => stripeReceiptSnapshot({ ...session, line_items: { ...session.line_items, has_more: true } })).toThrow();
    expect(() => stripeReceiptSnapshot({ ...session, amount_total: 9999 })).toThrow();
  });
  test('legacy receipts retain stored pricing and are not consolidated', () => {
    const legacy = { ...order, stripe_checkout_session_id: null, order_details: { line_items: [{ title: 'Legacy system', quantity: 1, price: 123, line_price: 123 }], total_price: 123 } };
    expect(extractReceiptData(legacy).total).toBe(123);
    expect(consolidateNativeOrders([legacy, { ...legacy, id: 'legacy-2' }])).toHaveLength(2);
  });
  test('currency conversion honors zero and three decimal currencies', () => {
    expect(currencyMinorDivisor('JPY')).toBe(1);
    expect(currencyMinorDivisor('KWD')).toBe(1000);
  });
});