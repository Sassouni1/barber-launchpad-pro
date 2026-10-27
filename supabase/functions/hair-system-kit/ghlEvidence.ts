import { KIT_LOCATION, type KitEvidence } from './logic.ts';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const str = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
const minor = (v: unknown): number => typeof v === 'number' && Number.isSafeInteger(v) ? v : NaN;

/** Project freshly read GHL order and transaction responses into the guarded kit contract.
 * Only the transaction's CURRENT chargeSnapshot is used. paymentProviders contains
 * snapshots captured before payment and is intentionally never read here.
 */
export function evidenceFromGhl(orderRaw: unknown, transactionRaw: unknown, readAt = new Date().toISOString()): KitEvidence {
  const order = obj(orderRaw), tx = obj(transactionRaw);
  const source = obj(order.source), item = Array.isArray(order.items) && order.items.length === 1 ? obj(order.items[0]) : {};
  const product = obj(item.product), price = obj(item.price);
  const snapshot = obj(tx.chargeSnapshot), metadata = obj(snapshot.metadata);
  const charge = Array.isArray(obj(snapshot.charges).data) && (obj(snapshot.charges).data as unknown[]).length === 1
    ? obj((obj(snapshot.charges).data as unknown[])[0]) : {};
  const shipping = obj(snapshot.shipping), address = obj(shipping.address);
  const contact = obj(order.contactSnapshot);
  const orderId = str(order._id), transactionId = str(tx._id), paymentId = str(snapshot.id);
  const amountReceived = minor(snapshot.amount_received);
  const transactionAmount = typeof tx.amount === 'number' && Number.isFinite(tx.amount) ? Math.round(tx.amount * 100) : NaN;
  if (!orderId || !transactionId || !paymentId || str(tx.entityId) !== orderId || str(metadata.orderId) !== orderId
    || str(tx.chargeId) !== paymentId || str(tx.contactId) !== str(order.contactId)
    || !Number.isSafeInteger(amountReceived) || amountReceived !== transactionAmount
    || str(order.altId) !== KIT_LOCATION || str(tx.altId) !== KIT_LOCATION) throw new Error('ghl_payment_linkage_unverified');
  const paidAt = typeof charge.created === 'number' && Number.isSafeInteger(charge.created)
    ? new Date(charge.created * 1000).toISOString() : '';
  return {
    readAt,
    order: { id: orderId, locationId: str(order.altId), paymentLinkId: str(source.id),
      completed: order.status === 'completed', paid: order.paymentStatus === 'paid' && order.liveMode === true,
      createdAt: str(order.createdAt), paidAt, productId: str(product._id), priceId: str(price._id),
      oneTime: price.type === 'one_time' && item.qty === 1 },
    transaction: { id: transactionId, orderId: str(tx.entityId), locationId: str(tx.altId),
      status: str(tx.status), currency: str(tx.currency).toLowerCase(), receivedMinor: amountReceived,
      refundedMinor: minor(tx.amountRefunded), providerPaymentId: str(tx.chargeId) },
    payment: { id: paymentId, transactionId, orderId: str(metadata.orderId), live: snapshot.livemode === true && tx.liveMode === true,
      status: str(snapshot.status), currency: str(snapshot.currency).toLowerCase(), receivedMinor: amountReceived,
      refundedMinor: minor(charge.amount_refunded), disputed: charge.disputed === true || charge.dispute != null || charge.refunded === true || charge.paid !== true || charge.captured !== true },
    shipping: { name: str(shipping.name), address1: str(address.line1), address2: str(address.line2),
      city: str(address.city), state: str(address.state), postal_code: str(address.postal_code), country: str(address.country) },
    contact: { email: str(contact.email), phone: str(contact.phone) },
  };
}
