// A row is a purchase receipt only once payment is confirmed. Unpaid checkout
// attempts ("pending_payment") are kept for audit but never shown or printed.
export const UNPAID_ORDER_STATUSES = ["pending_payment"] as const;

export function isReceiptEligible(order: { status?: string | null }): boolean {
  return !UNPAID_ORDER_STATUSES.includes(String(order?.status ?? "") as (typeof UNPAID_ORDER_STATUSES)[number]);
}

export function receiptEligibleOrders<T extends { status?: string | null }>(orders: T[] | null | undefined): T[] {
  return (orders ?? []).filter(isReceiptEligible);
}
