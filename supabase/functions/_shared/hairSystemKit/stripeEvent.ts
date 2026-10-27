import { KIT_LOCATION, KIT_STRIPE_APPLICATION, kitEnrollmentOffer } from './logic.ts';

/** Only a signed, live GHL enrollment PaymentIntent can enter the kit path.
 * The current PaymentIntent and charge are re-read before any write or send. */
export function kitPaymentEvent(event: Record<string, unknown>): { orderId: string; paymentId: string; contactId: string } | null {
  if (event.type !== 'payment_intent.succeeded' || event.livemode !== true) return null;
  const envelope = event.data as Record<string, unknown> | undefined;
  const payment = envelope?.object as Record<string, unknown> | undefined;
  const metadata = payment?.metadata as Record<string, unknown> | undefined;
  if (payment?.object !== 'payment_intent' || payment.livemode !== true ||
    payment.application !== KIT_STRIPE_APPLICATION || !kitEnrollmentOffer(String(payment.description ?? '')) ||
    metadata?.altId !== KIT_LOCATION || metadata?.altType !== 'location') return null;
  const orderId = String(metadata.orderId ?? '');
  const paymentId = String(payment.id ?? '');
  const contactId = String(metadata.contactId ?? '');
  if (!/^[a-f0-9]{24}$/i.test(orderId) || !/^pi_[A-Za-z0-9]+$/.test(paymentId) ||
    !/^[A-Za-z0-9]{20}$/.test(contactId)) return null;
  return { orderId, paymentId, contactId };
}
