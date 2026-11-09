import { KIT_ENROLLMENT_OFFERS, KIT_LOCATION, KIT_STRIPE_APPLICATION, KIT_ITEMS, type KitEvidence } from './logic.ts';

export type ManualAddress = { name: string; address1: string; address2?: string; city: string; state: string; postal_code: string; country: string };
export type ManualRequest = {
  order_id: string; payment_id: string; contact_id: string;
  shipping: ManualAddress; shipping_confirmed: true; address_evidence: string;
  reason: string; release_basis: 'fully_paid' | 'installment_entitlement' | 'admin_entitlement';
};

/** Deployment scope is an explicit list of the individually approved GHL orders. */
export function manualOrderInScope(orderId: string, configuredIds: string): boolean {
  const ids = configuredIds.split(',').map(v => v.trim()).filter(Boolean);
  return ids.length > 0 && ids.every(id => /^[a-f0-9]{24}$/i.test(id)) && ids.includes(orderId);
}

export async function authorizeKitAdmin(authHeader: string | null,
  readUser: (token: string) => Promise<string | null>, readAdmin: (userId: string) => Promise<boolean>) {
  if (!authHeader?.startsWith('Bearer ') || !authHeader.slice(7)) return { ok: false as const, status: 401 };
  let userId: string | null;
  try { userId = await readUser(authHeader.slice(7)); } catch { return { ok: false as const, status: 401 }; }
  if (!userId) return { ok: false as const, status: 401 };
  try { if (!await readAdmin(userId)) return { ok: false as const, status: 403 }; }
  catch { return { ok: false as const, status: 403 }; }
  return { ok: true as const, userId };
}

const clean = (s: string) => s.trim();
export function normalizeManualRequest(input: ManualRequest): ManualRequest {
  return { ...input, order_id: clean(input.order_id), payment_id: clean(input.payment_id), contact_id: clean(input.contact_id),
    address_evidence: clean(input.address_evidence), reason: clean(input.reason), shipping: {
      name: clean(input.shipping.name), address1: clean(input.shipping.address1), address2: clean(input.shipping.address2 ?? ''),
      city: clean(input.shipping.city), state: clean(input.shipping.state), postal_code: clean(input.shipping.postal_code),
      country: clean(input.shipping.country).toUpperCase(),
    } };
}

/** Manual release never changes the automatic full-payment/cutover rule. */
export function qualifyManualKit(e: KitEvidence, input: ManualRequest, ghlOrder: {
  id: string; locationId: string; contactId: string; productIds: string[]; paymentStatus: string; status: string; updatedAt: string;
}): string | null {
  const offer = Object.entries(KIT_ENROLLMENT_OFFERS).find(([, value]) => value.description === e.order.description);
  if (input.release_basis !== 'admin_entitlement' && (!offer || !ghlOrder.productIds.includes(offer[0])))
    return 'membership_entitlement_unverified';
  const businessStateAccepted = input.release_basis === 'admin_entitlement'
    ? Boolean(ghlOrder.status && ghlOrder.paymentStatus)
    : ['completed', 'partially_fulfilled'].includes(ghlOrder.status) &&
      ['paid', 'partially_paid'].includes(ghlOrder.paymentStatus);
  if (ghlOrder.id !== input.order_id || ghlOrder.locationId !== KIT_LOCATION || ghlOrder.contactId !== input.contact_id ||
    !businessStateAccepted) return 'ghl_order_unverified';
  const p = e.payment;
  if (!Number.isFinite(Date.parse(e.order.createdAt)) || !Number.isFinite(Date.parse(e.order.paidAt)) ||
    Date.parse(e.order.paidAt) < Date.parse(e.order.createdAt) || !Number.isFinite(Date.parse(ghlOrder.updatedAt)))
    return 'purchase_timing_unverified';
  if (e.order.id !== input.order_id || e.order.locationId !== KIT_LOCATION || p.id !== input.payment_id ||
    p.orderId !== input.order_id || p.contactId !== input.contact_id || p.locationId !== KIT_LOCATION ||
    p.application !== KIT_STRIPE_APPLICATION) return 'payment_linkage_unverified';
  if (!/^pi_[A-Za-z0-9]+$/.test(p.id) || !/^(ch|py)_[A-Za-z0-9]+$/.test(p.chargeId) ||
    !p.live || p.status !== 'succeeded' || p.chargeStatus !== 'succeeded' || !p.chargePaid || !p.chargeCaptured ||
    p.disputed || p.refundedMinor !== 0 || p.currency !== 'usd' || !Number.isSafeInteger(p.receivedMinor) ||
    p.receivedMinor <= 0 || p.chargeAmountMinor !== p.receivedMinor) return 'payment_not_cleared';
  const threshold = offer?.[1].minimumReceivedMinor ?? Infinity;
  if (input.release_basis === 'fully_paid' && (p.receivedMinor < threshold || ghlOrder.paymentStatus !== 'paid')) return 'not_fully_paid';
  if (input.release_basis === 'installment_entitlement' && (p.receivedMinor >= threshold || p.receivedMinor < 80000 ||
    ghlOrder.paymentStatus !== 'partially_paid')) return 'installment_entitlement_unverified';
  if (input.shipping_confirmed !== true || input.reason.length < 12 || input.address_evidence.length < 12) return 'manual_confirmation_missing';
  const s = input.shipping;
  if ([s.name, s.address1, s.city, s.state, s.postal_code, s.country].some(v => !v || v.length > 120) ||
    s.address2!.length > 120 || s.country !== 'US' || !/^[0-9]{5}(?:-[0-9]{4})?$/.test(s.postal_code)) return 'shipping_incomplete';
  // Existing payment shipping is authoritative. A manual address can fill a missing destination,
  // but a disagreement requires separate human reconciliation before any supplier send.
  for (const key of ['name','address1','address2','city','state','postal_code','country'] as const) {
    if (e.shipping[key] && e.shipping[key].trim().toLowerCase() !== s[key]!.trim().toLowerCase()) return 'shipping_conflict';
  }
  if (!e.contact.email || !e.contact.phone) return 'contact_unverified';
  if (Date.now() - Date.parse(e.readAt) > 30_000 || !Number.isFinite(Date.parse(e.readAt))) return 'payment_evidence_stale';
  if (KIT_ITEMS.length !== 6) return 'kit_manifest_invalid';
  return null;
}

export function manualPreviewFacts(e: KitEvidence, input: ManualRequest,
  ghlOrder: { updatedAt: string; paymentStatus: string; status: string; productIds: string[] }) {
  return { order_id: input.order_id, payment_id: e.payment.id, charge_id: e.payment.chargeId,
    contact_id: input.contact_id, contact_email: e.contact.email, contact_phone: e.contact.phone,
    amount_received_minor: e.payment.receivedMinor,
    purchase_description: e.order.description, release_basis: input.release_basis,
    ghl_payment_status: ghlOrder.paymentStatus, ghl_order_status: ghlOrder.status,
    ghl_product_ids: ghlOrder.productIds,
    shipping: input.shipping, address_evidence: input.address_evidence, reason: input.reason,
    ghl_updated_at: ghlOrder.updatedAt, supplier: 'sales30@newtimeshair.com', kit_items: KIT_ITEMS };
}
