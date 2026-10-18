// Monetary snapshots contain only Stripe receipt fields, never payment credentials.
export type StripeReceipt = {
  session_id: string;
  currency: string;
  total_minor: number;
  purchased_at: string;
  items: { title: string; quantity: number; unit_minor: number; total_minor: number }[];
  scope: "checkout";
};

export function receiptAccessAllowed(userId: string, admin: boolean, ownerId: string | null) {
  return admin || (ownerId !== null && userId === ownerId);
}

export function verifyReceiptOrder(order: Record<string, any>, session: Record<string, any>) {
  if (order.status === "pending_payment" || session.payment_status !== "paid" || session.object !== "checkout.session") throw new Error("Payment is not confirmed.");
  if (session.id !== order.stripe_checkout_session_id || session.metadata?.user_id !== order.user_id) throw new Error("Checkout does not match this order.");
  if (order.checkout_draft_id) {
    if (session.metadata?.draft_id !== order.checkout_draft_id || !Number.isInteger(order.system_index) || order.system_index < 0 || order.payment_reference !== `stripe:${session.id}:${order.system_index}`) throw new Error("Draft checkout does not match this order.");
  } else if (!String(session.metadata?.order_ids ?? "").split(",").map((id) => id.trim()).includes(order.id)) {
    throw new Error("Checkout does not contain this order.");
  }
}

export function stripeReceiptSnapshot(session: Record<string, any>): StripeReceipt {
  if (session.object !== "checkout.session" || session.payment_status !== "paid") throw new Error("Payment is not confirmed.");
  if (!Number.isSafeInteger(session.amount_total) || session.amount_total < 0 || !/^[a-z]{3}$/.test(session.currency ?? "") || !Number.isFinite(session.created)) throw new Error("Stripe amount is unavailable.");
  if (!Array.isArray(session.line_items?.data) || session.line_items.has_more || !session.line_items.data.length) throw new Error("Stripe line items are unavailable.");
  const items = session.line_items.data.map((item: Record<string, any>) => {
    if (!Number.isSafeInteger(item.amount_total) || item.amount_total < 0 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.currency !== session.currency) throw new Error("Stripe line item amount is unavailable.");
    return { title: String(item.description || item.price?.product?.name || "Hair System Order"), quantity: item.quantity, unit_minor: item.amount_total / item.quantity, total_minor: item.amount_total };
  });
  const shipping = session.total_details?.amount_shipping;
  if (Number.isSafeInteger(shipping) && shipping > 0) items.push({ title: "Shipping", quantity: 1, unit_minor: shipping, total_minor: shipping });
  // Discounts/tax may be applied at session level. Never silently invent them.
  const subtotal = items.reduce((sum: number, item: { total_minor: number }) => sum + item.total_minor, 0);
  const difference = session.amount_total - subtotal;
  if (difference !== 0) {
    const tax = session.total_details?.amount_tax ?? 0;
    const discount = session.total_details?.amount_discount ?? 0;
    if (!Number.isSafeInteger(tax) || !Number.isSafeInteger(discount) || difference !== tax - discount) throw new Error("Stripe line items do not reconcile to payment.");
    if (tax) items.push({ title: "Tax", quantity: 1, unit_minor: tax, total_minor: tax });
    if (discount) items.push({ title: "Discount", quantity: 1, unit_minor: -discount, total_minor: -discount });
  }
  return { session_id: String(session.id), currency: session.currency.toUpperCase(), total_minor: session.amount_total, purchased_at: new Date(session.created * 1000).toISOString(), items, scope: "checkout" };
}