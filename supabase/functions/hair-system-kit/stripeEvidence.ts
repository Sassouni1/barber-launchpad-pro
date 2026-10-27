import { KIT_LOCATION, KIT_STRIPE_APPLICATION, type KitEvidence } from './logic.ts';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const str = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
const minor = (v: unknown): number => typeof v === 'number' && Number.isSafeInteger(v) ? v : NaN;
const iso = (seconds: unknown): string => typeof seconds === 'number' && Number.isSafeInteger(seconds) && seconds > 0
  ? new Date(seconds * 1000).toISOString() : '';

/** Map a freshly retrieved PaymentIntent with an expanded latest_charge.
 * Search results, workflow values, billing addresses and historical snapshots
 * are never treated as payment or shipping evidence.
 */
export function evidenceFromStripe(raw: unknown, orderId: string, phone: string, readAt = new Date().toISOString()): KitEvidence {
  const pi = obj(raw), charge = obj(pi.latest_charge);
  const metadata = obj(pi.metadata), chargeMetadata = obj(charge.metadata);
  const shipping = obj(pi.shipping), chargeShipping = obj(charge.shipping);
  const address = obj(shipping.address), chargeAddress = obj(chargeShipping.address);
  const billing = obj(charge.billing_details);
  const piId = str(pi.id), chargeId = str(charge.id);
  if (!piId || !chargeId || str(pi.object) !== 'payment_intent' || str(charge.object) !== 'charge' ||
    str(charge.payment_intent) !== piId || str(metadata.orderId) !== orderId || str(chargeMetadata.orderId) !== orderId ||
    str(metadata.altId) !== KIT_LOCATION || str(chargeMetadata.altId) !== KIT_LOCATION ||
    str(metadata.altType) !== 'location' || str(chargeMetadata.altType) !== 'location' ||
    !str(metadata.contactId) || str(chargeMetadata.contactId) !== str(metadata.contactId) ||
    str(pi.application) !== KIT_STRIPE_APPLICATION || str(charge.application) !== KIT_STRIPE_APPLICATION ||
    str(pi.description) !== str(charge.description) ||
    str(shipping.name) !== str(chargeShipping.name) ||
    ['line1','line2','city','state','postal_code','country'].some(k => str(address[k]) !== str(chargeAddress[k]))) {
    throw new Error('stripe_order_linkage_unverified');
  }
  return {
    readAt,
    order: { id: orderId, locationId: str(metadata.altId), description: str(pi.description),
      createdAt: iso(pi.created), paidAt: iso(charge.created) },
    payment: { id: piId, orderId: str(metadata.orderId), locationId: str(metadata.altId),
      contactId: str(metadata.contactId), application: str(pi.application),
      live: pi.livemode === true && charge.livemode === true,
      status: str(pi.status), currency: str(pi.currency).toLowerCase(), receivedMinor: minor(pi.amount_received),
      chargeId, chargeStatus: str(charge.status), chargePaid: charge.paid === true,
      chargeCaptured: charge.captured === true, chargeAmountMinor: minor(charge.amount_captured),
      refundedMinor: minor(charge.amount_refunded),
      disputed: charge.disputed === true || charge.dispute != null || charge.refunded === true },
    shipping: { name: str(shipping.name), address1: str(address.line1), address2: str(address.line2),
      city: str(address.city), state: str(address.state), postal_code: str(address.postal_code), country: str(address.country) },
    contact: { email: str(billing.email).toLowerCase(), phone: phone.trim() },
  };
}
