import type { Tables } from '@/integrations/supabase/types';

type Order = Tables<'orders'>;
export type NativeReceipt = {
  session_id: string; currency: string; total_minor: number; purchased_at: string; scope: 'checkout';
  items: { title: string; quantity: number; unit_minor: number; total_minor: number }[];
};
export type NativeReceiptResult = { receipt: NativeReceipt; orders: Order[] };

// A checkout is a single purchase, even when it produced several system rows.
export function consolidateNativeOrders<T extends { stripe_checkout_session_id?: string | null }>(orders: T[]): T[] {
  const seen = new Set<string>();
  return orders.filter((order) => {
    const id = order.stripe_checkout_session_id;
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function withNativeReceipt(order: Order, result: NativeReceiptResult): Order {
  if (result.receipt.session_id !== order.stripe_checkout_session_id) throw new Error('Receipt does not match checkout.');
  const details = (order.order_details ?? {}) as Record<string, any>;
  return { ...order, order_date: result.receipt.purchased_at, external_order_id: result.receipt.session_id,
    order_details: { ...details, stripe_receipt: result.receipt, checkout_system_details: result.orders.map((o) => o.order_details) } as Order['order_details'] };
}

export function currencyMinorDivisor(currency: string): number {
  const digits = new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  return 10 ** (digits ?? 2);
}