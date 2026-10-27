// Prepared kit pipeline. Keep the activation gate disabled until a real
// product-filtered workflow payload and server Stripe search are verified.
export const KIT_LOCATION = 'JVBUuL3dVwZahuGay9T1';
export const KIT_STRIPE_ACCOUNT = 'acct_1LMNKMI6LFtj88Bq';
export const KIT_STRIPE_APPLICATION = 'ca_D5Mpe2emSMW6EZeofhNaydC4Kq5zGxQo';
export const KIT_ENROLLMENT_DESCRIPTION = 'Barber Launch Hair System Mastery & Marketing ($2997)';
export const KIT_2997_PRODUCT = '69c04272e1fa5f9772b8a7ea';
export const KIT_1997_PRODUCT = '69124b3bff3e41840f4d4b2d';
export const KIT_ENROLLMENT_OFFERS = {
  [KIT_2997_PRODUCT]: { description: KIT_ENROLLMENT_DESCRIPTION, minimumReceivedMinor: 299700 },
  [KIT_1997_PRODUCT]: { description: 'Barber Launch Hair System Mastery & Marketing ($1997)', minimumReceivedMinor: 199700 },
} as const;
export const KIT_ITEMS = ['One #2 skin hair system', 'One #2 lace hair system', 'Color wheel', 'Adhesive', 'Tape', 'C22 spray'];

/** Only these two identified GHL enrollment products are kit candidates.
 * Each still needs its own freshly verified full payment and shipping. */
export function kitEnrollmentOffer(productId: string): { description: string; minimumReceivedMinor: number } | null {
  return KIT_ENROLLMENT_OFFERS[productId as keyof typeof KIT_ENROLLMENT_OFFERS] ?? null;
}

export type KitEvidence = {
  readAt: string;
  order: { id: string; locationId: string; description: string; createdAt: string; paidAt: string };
  payment: { id: string; orderId: string; locationId: string; contactId: string; application: string;
    live: boolean; status: string; currency: string; receivedMinor: number; chargeId: string;
    chargeStatus: string; chargePaid: boolean; chargeCaptured: boolean; chargeAmountMinor: number;
    refundedMinor: number; disputed: boolean };
  shipping: { name: string; address1: string; address2?: string; city: string; state: string; postal_code: string; country: string };
  contact: { email: string; phone: string };
};

export function qualifyKit(e: KitEvidence, orderId: string, cutoff: string, now = Date.now(), productId = KIT_2997_PRODUCT): string | null {
  const offer = kitEnrollmentOffer(productId);
  if (!offer) return 'unrelated_product';
  const c = Date.parse(cutoff), read = Date.parse(e.readAt);
  if (!Number.isFinite(c) || c > now || !Number.isFinite(read) || read > now || now - read > 30_000) return 'fresh_evidence_or_cutoff_missing';
  const o = e.order, p = e.payment;
  const created = Date.parse(o.createdAt), paid = Date.parse(o.paidAt);
  if (!Number.isFinite(created) || !Number.isFinite(paid) || created <= c || paid < created || paid > now) return 'historical_or_ambiguous_purchase';
  if (o.id !== orderId || o.locationId !== KIT_LOCATION || p.orderId !== orderId || p.locationId !== KIT_LOCATION ||
    !p.contactId || p.application !== KIT_STRIPE_APPLICATION) return 'payment_linkage_missing';
  // GHL-origin Stripe payments in the observed flow have no immutable product
  // ID. Bind the static product ID from its verified workflow branch to the
  // exact Stripe description and that product's full-payment threshold.
  if (o.description !== offer.description) return 'wrong_order_or_offer';
  if (!/^pi_[A-Za-z0-9]+$/.test(p.id) || !/^(ch|py)_[A-Za-z0-9]+$/.test(p.chargeId) ||
    p.live !== true || p.status !== 'succeeded' || p.chargeStatus !== 'succeeded' ||
    p.chargePaid !== true || p.chargeCaptured !== true || p.disputed !== false) return 'payment_not_completed';
  if (p.currency !== 'usd') return 'wrong_currency';
  if (!Number.isSafeInteger(p.receivedMinor) || p.receivedMinor < offer.minimumReceivedMinor ||
    !Number.isSafeInteger(p.chargeAmountMinor) || p.chargeAmountMinor !== p.receivedMinor) return 'received_amount_not_verified';
  if (p.refundedMinor !== 0) return 'refunded_or_unknown';
  if (['name','address1','city','state','postal_code','country'].some(k => !String(e.shipping[k as keyof typeof e.shipping] ?? '').trim())) return 'shipping_missing';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.contact.email) || !e.contact.phone.trim()) return 'contact_missing';
  return null;
}

export function kitOrderRow(e: KitEvidence) {
  return {
    external_order_id: e.order.id, user_id: null, customer_name: e.shipping.name,
    customer_email: e.contact.email, status: 'pending', order_date: e.order.paidAt,
    payment_reference: `stripe:${e.payment.id}`,
    order_details: { supplier_kit: true, full_name: e.shipping.name, phone: e.contact.phone,
      shipping_address: e.shipping, ghl_location_id: KIT_LOCATION,
      ghl_order_id: e.order.id, provider_payment_id: e.payment.id,
      stripe_charge_id: e.payment.chargeId, purchase_description: e.order.description,
      purchased_at: e.order.paidAt,
      order: { line_items: KIT_ITEMS.map(title => ({ title, quantity: 1 })) } },
  };
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c)); }
export function kitEmail(orderId: string, evidence: KitEvidence) {
  const url = `https://member.thebarberlaunch.com/newtimes?order=${encodeURIComponent(orderId)}`;
  const address = [evidence.shipping.address1, evidence.shipping.address2, evidence.shipping.city,
    evidence.shipping.state, evidence.shipping.postal_code, evidence.shipping.country].filter(Boolean).join(', ');
  return { role: 'supplier', to: 'sales30@newtimeshair.com', subject: 'New Hair System Kit Order',
    html: `<p>New order for ${escapeHtml(evidence.shipping.name)} at ${escapeHtml(address)}.</p><p><a href="${escapeHtml(url)}">Click here to view order and add tracking details.</a></p>` };
}
type Deps = {
  readFresh: (orderId: string) => Promise<KitEvidence>;
  ensureRow: (row: ReturnType<typeof kitOrderRow>) => Promise<string>;
  confirmVisible: (id: string, e: KitEvidence) => Promise<boolean>;
  reserve: (locationId: string, orderId: string, rowId: string) => Promise<boolean>;
  send: (mail: ReturnType<typeof kitEmail>) => Promise<{ ok: boolean; messageId?: string | null }>;
  finish: (orderId: string, status: 'sent' | 'uncertain', messageId: string | null) => Promise<void>;
};
export async function processKit(orderId: string, productId: string, gate: { enabled: boolean; cutoff: string } | null, d: Deps) {
  if (gate?.enabled !== true) return { status: 'inactive' };
  if (!kitEnrollmentOffer(productId)) return { status: 'blocked', reason: 'unrelated_product' };
  let e: KitEvidence;
  try { e = await d.readFresh(orderId); } catch { return { status: 'blocked', reason: 'fresh_stripe_reads_unavailable' }; }
  const reason = qualifyKit(e, orderId, gate.cutoff, Date.now(), productId);
  if (reason) return { status: 'blocked', reason };
  const rowId = await d.ensureRow(kitOrderRow(e));
  if (!await d.confirmVisible(rowId, e)) return { status: 'blocked', reason: 'supplier_page_visibility_unverified' };
  // Permanent reservation precedes the only send; no reclaim/stale timeout.
  if (!await d.reserve(KIT_LOCATION, orderId, rowId)) return { status: 'reserved_no_retry' };
  try {
    const r = await d.send(kitEmail(orderId, e));
    const status = r.ok && r.messageId ? 'sent' : 'uncertain';
    await d.finish(orderId, status, r.messageId ?? null);
    return { status };
  } catch {
    await d.finish(orderId, 'uncertain', null).catch(() => {});
    return { status: 'uncertain' };
  }
}
