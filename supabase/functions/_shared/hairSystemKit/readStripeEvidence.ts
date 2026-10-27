import { KIT_STRIPE_ACCOUNT, type KitEvidence } from './logic.ts';
import { evidenceFromStripe } from './stripeEvidence.ts';

const ORDER_ID = /^[a-f0-9]{24}$/i;
const PI_ID = /^pi_[A-Za-z0-9]+$/;
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};

async function stripeGet(path: string, token: string, fetcher: typeof fetch): Promise<Obj> {
  const response = await fetcher(`https://api.stripe.com/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`stripe_payment_read_${response.status}`);
  const data = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('stripe_payment_response_invalid');
  return data as Obj;
}

/** Search binds a GHL order ID to exactly one PI. Retrieval then supplies
 * current payment, charge and shipping state; search-index data is not proof.
 * Missing or ambiguous search always fails closed. A bounded read retry covers
 * ordinary indexing lag; 503 tells the caller a later retry is still needed.
 */
export async function readStripeEvidence(orderId: string, phone: string, token: string, fetcher: typeof fetch = fetch,
  retryDelaysMs: number[] = [500, 1500]): Promise<KitEvidence> {
  if (!ORDER_ID.test(orderId)) throw new Error('invalid_ghl_order_id');
  if (!token.trim()) throw new Error('stripe_key_unavailable');
  const account = await stripeGet('/account', token, fetcher);
  if (account.id !== KIT_STRIPE_ACCOUNT) throw new Error('wrong_stripe_seller');
  const query = encodeURIComponent(`metadata['orderId']:'${orderId}'`);
  let search: Obj = {};
  let hits: unknown[] = [];
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    search = await stripeGet(`/payment_intents/search?query=${query}&limit=2`, token, fetcher);
    hits = Array.isArray(search.data) ? search.data : [];
    if (hits.length > 0) break;
    if (attempt < retryDelaysMs.length) await new Promise(resolve => setTimeout(resolve, retryDelaysMs[attempt]));
  }
  if (hits.length === 0) throw new Error('stripe_payment_not_indexed');
  if (hits.length !== 1 || search.has_more !== false) throw new Error('stripe_payment_ambiguous');
  const paymentId = String(obj(hits[0]).id ?? '');
  if (!PI_ID.test(paymentId)) throw new Error('stripe_payment_id_invalid');
  const payment = await stripeGet(`/payment_intents/${encodeURIComponent(paymentId)}?expand[]=latest_charge`, token, fetcher);
  return evidenceFromStripe(payment, orderId, phone);
}

/** A signed Stripe event identifies the PaymentIntent directly. Re-retrieve it
 * and its charge so event snapshots never authorize fulfillment. */
export async function readStripeEvidenceByPaymentIntent(paymentId: string, orderId: string, phone: string,
  token: string, fetcher: typeof fetch = fetch): Promise<KitEvidence> {
  if (!PI_ID.test(paymentId) || !ORDER_ID.test(orderId)) throw new Error('invalid_payment_reference');
  if (!token.trim()) throw new Error('stripe_key_unavailable');
  const account = await stripeGet('/account', token, fetcher);
  if (account.id !== KIT_STRIPE_ACCOUNT) throw new Error('wrong_stripe_seller');
  const payment = await stripeGet(`/payment_intents/${encodeURIComponent(paymentId)}?expand[]=latest_charge`, token, fetcher);
  if (payment.id !== paymentId) throw new Error('stripe_payment_id_mismatch');
  return evidenceFromStripe(payment, orderId, phone);
}
