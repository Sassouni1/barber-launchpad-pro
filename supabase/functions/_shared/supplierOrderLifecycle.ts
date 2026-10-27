export const COMPLETED_AT_KEY = 'supplier_completed_at';
export const ARCHIVE_DELAY_MS = 8 * 24 * 60 * 60 * 1000;
export const CURRENT_ORDERS_START = Date.parse('2026-10-21T01:48:00Z');
type OrderState = { status: string; tracking_number: string | null; order_details: unknown; updated_at: string; order_date?: string; tracking_seen?: boolean };
const detailsObject = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? { ...v as Record<string, unknown> } : {};
export const isSupplierCompleted = (o: OrderState) => o.status === 'shipped' && !!o.tracking_number;
export function completionTime(o: OrderState): number | null {
  if (!isSupplierCompleted(o)) return null;
  const d = detailsObject(o.order_details);
  const value = d[COMPLETED_AT_KEY] ?? d.supplier_tracking_added_at ?? o.updated_at;
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}
export function supplierOrderSection(o: OrderState, now: number): 'current' | 'completed' | 'past' {
  if (isSupplierCompleted(o)) {
    const time = completionTime(o);
    if (time !== null && now - time >= ARCHIVE_DELAY_MS) return 'past';
    // Preserve legacy historical grouping without moving working tracked orders.
    if (!detailsObject(o.order_details)[COMPLETED_AT_KEY] && Date.parse(o.order_date ?? '') < CURRENT_ORDERS_START) return 'past';
    return 'completed';
  }
  if (o.tracking_number || detailsObject(o.order_details).supplier_completion_undone_at || Array.isArray(detailsObject(o.order_details).supplier_reopen_history)) return 'current';
  return Date.parse(o.order_date ?? '') < CURRENT_ORDERS_START ? 'past' : 'current';
}
export function preserveCompletionClock(o: OrderState): Record<string, unknown> {
  const d = detailsObject(o.order_details);
  if (isSupplierCompleted(o) && !d[COMPLETED_AT_KEY]) {
    d[COMPLETED_AT_KEY] = d.supplier_tracking_added_at || o.updated_at;
  }
  return d;
}
export function trackingSaveStatus(status: string): string {
  return status === 'shipped' ? 'shipped' : 'processing';
}
export function completionUpdate(o: OrderState, completed: boolean, now: string) {
  if (!o.tracking_number?.trim()) throw new Error('At least one tracking number is required before Completed.');
  if (completed && isSupplierCompleted(o)) throw new Error('Order is already completed. Refresh and try again.');
  if (!completed && !isSupplierCompleted(o)) throw new Error('Order is no longer completed. Refresh and try again.');
  if (o.status !== 'processing' && o.status !== 'pending' && o.status !== 'shipped') throw new Error('Order cannot be completed in its current state.');
  const d = detailsObject(o.order_details);
  if (completed) {
    d[COMPLETED_AT_KEY] = now;
    delete d.supplier_completion_undone_at;
    return { status: 'shipped', order_details: d, tracking_seen: d.supplier_shipment_previously_completed === true ? true : o.tracking_seen ?? false };
  }
  delete d[COMPLETED_AT_KEY];
  d.supplier_completion_undone_at = now;
  d.supplier_shipment_previously_completed = true;
  return { status: 'processing', order_details: d, tracking_seen: o.tracking_seen ?? false };
}