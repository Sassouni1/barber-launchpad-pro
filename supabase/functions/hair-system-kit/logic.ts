// This is an INTERNAL evidence contract, NOT an invented GHL API response.
// A real fresh-read adapter must verify/map actual GHL responses before binding.
export const KIT_LOCATION = 'JVBUuL3dVwZahuGay9T1';
export const KIT_LINK = '69c05205b5622a509ebe35cd';
export const KIT_PRODUCT = '69c04272e1fa5f9772b8a7ea';
export const KIT_PRICE = '69c04272e1fa5fd8dab8a7ef';
export const KIT_ITEMS = ['1 #2 skin system', '1 #2 lace system', 'color wheel', 'adhesive', 'tape', 'C22 spray'];
export type KitEvidence = {
  readAt: string;
  order: { id: string; locationId: string; paymentLinkId: string; completed: boolean; paid: boolean; createdAt: string; paidAt: string; productId: string; priceId: string; oneTime: boolean };
  transaction: { id: string; orderId: string; locationId: string; status: string; currency: string; receivedMinor: number; refundedMinor: number; providerPaymentId: string };
  payment: { id: string; transactionId: string; orderId: string; live: boolean; status: string; currency: string; receivedMinor: number; refundedMinor: number; disputed: boolean };
  shipping: { name: string; address1: string; address2?: string; city: string; state: string; postal_code: string; country: string };
  contact: { email: string; phone: string };
};
export function qualifyKit(e: KitEvidence, orderId: string, cutoff: string, now = Date.now()): string | null {
  const c = Date.parse(cutoff), read = Date.parse(e.readAt);
  if (!Number.isFinite(c) || c > now || !Number.isFinite(read) || read > now || now - read > 30_000) return 'fresh_evidence_or_cutoff_missing';
  const o = e.order, t = e.transaction, p = e.payment;
  const created = Date.parse(o.createdAt), paid = Date.parse(o.paidAt);
  if (!Number.isFinite(created) || !Number.isFinite(paid) || created <= c || paid < created || paid > now) return 'historical_or_ambiguous_purchase';
  if (o.id !== orderId || o.locationId !== KIT_LOCATION || o.paymentLinkId !== KIT_LINK || o.productId !== KIT_PRODUCT || o.priceId !== KIT_PRICE || o.oneTime !== true) return 'wrong_order_or_offer';
  if (o.completed !== true || o.paid !== true || t.status !== 'succeeded' || p.status !== 'succeeded' || p.live !== true || p.disputed !== false) return 'payment_not_completed';
  if (!t.id || !p.id || !/^(pi|ch)_[A-Za-z0-9]+$/.test(p.id) || t.locationId !== KIT_LOCATION || t.orderId !== orderId || p.orderId !== orderId || p.transactionId !== t.id || t.providerPaymentId !== p.id) return 'payment_linkage_missing';
  if (t.currency !== 'usd' || p.currency !== 'usd') return 'wrong_currency';
  if (!Number.isSafeInteger(t.receivedMinor) || !Number.isSafeInteger(p.receivedMinor) || t.receivedMinor < 299700 || p.receivedMinor !== t.receivedMinor) return 'received_amount_not_verified';
  if (t.refundedMinor !== 0 || p.refundedMinor !== 0) return 'refunded_or_unknown';
  if (['name','address1','city','state','postal_code','country'].some(k => !String(e.shipping[k as keyof typeof e.shipping] ?? '').trim())) return 'shipping_missing';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.contact.email) || !e.contact.phone.trim()) return 'contact_missing';
  return null;
}
export function kitOrderRow(e: KitEvidence) {
  return {
    external_order_id: e.order.id, user_id: null, customer_name: e.shipping.name,
    customer_email: e.contact.email, status: 'pending', order_date: e.order.paidAt,
    order_details: { supplier_kit: true, full_name: e.shipping.name, phone: e.contact.phone,
      shipping_address: e.shipping, ghl_location_id: KIT_LOCATION,
      order: { line_items: KIT_ITEMS.map(title => ({ title, quantity: 1 })) } },
  };
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c)); }
export function kitEmail(orderId: string) {
  const url = `https://member.thebarberlaunch.com/newtimes?order=${encodeURIComponent(orderId)}`;
  return { role: 'supplier', to: 'sales30@newtimeshair.com', subject: 'New Hair System Kit Order',
    html: `<p>Order reference: ${escapeHtml(orderId)}</p><p><a href="${escapeHtml(url)}">View order</a></p>` };
}
type Deps = {
  readFresh: (orderId: string) => Promise<KitEvidence>;
  ensureRow: (row: ReturnType<typeof kitOrderRow>) => Promise<string>;
  confirmVisible: (id: string, e: KitEvidence) => Promise<boolean>;
  reserve: (locationId: string, orderId: string, rowId: string) => Promise<boolean>;
  send: (mail: ReturnType<typeof kitEmail>) => Promise<{ ok: boolean; messageId?: string | null }>;
  finish: (orderId: string, status: 'sent' | 'uncertain', messageId: string | null) => Promise<void>;
};
export async function processKit(orderId: string, gate: { enabled: boolean; cutoff: string } | null, d: Deps) {
  if (gate?.enabled !== true) return { status: 'inactive' };
  let e: KitEvidence;
  try { e = await d.readFresh(orderId); } catch { return { status: 'blocked', reason: 'fresh_ghl_reads_unavailable' }; }
  const reason = qualifyKit(e, orderId, gate.cutoff);
  if (reason) return { status: 'blocked', reason };
  const rowId = await d.ensureRow(kitOrderRow(e));
  if (!await d.confirmVisible(rowId, e)) return { status: 'blocked', reason: 'supplier_page_visibility_unverified' };
  // Permanent reservation precedes the only send; no reclaim/stale timeout.
  if (!await d.reserve(KIT_LOCATION, orderId, rowId)) return { status: 'reserved_no_retry' };
  try {
    const r = await d.send(kitEmail(orderId));
    const status = r.ok && r.messageId ? 'sent' : 'uncertain';
    await d.finish(orderId, status, r.messageId ?? null);
    return { status };
  } catch {
    // If audit fails too, permanent reserved state still prevents resend.
    await d.finish(orderId, 'uncertain', null).catch(() => {});
    return { status: 'uncertain' };
  }
}