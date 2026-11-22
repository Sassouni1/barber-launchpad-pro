// Member Billing view helpers. Cards arrive already masked from the server.
export type BillingCard = {
  id: string; brand: string; last4: string; expMonth: number; expYear: number;
  expired: boolean; isDefault: boolean; redisplay: 'always' | 'limited' | 'unspecified';
};
export type BillingOrder = {
  id: string; domain: string; status: string; member_charge_cents: number; currency: string;
  last_error: string | null; created_at: string; receipt_url: string | null;
};
export type BillingCustomer = { status: 'linked' | 'none' | 'unresolved'; reason?: string };
export type BillingSummary = { customer: BillingCustomer; cards: BillingCard[]; orders: BillingOrder[] };
export type DomainPaymentChoice = { method: 'saved'; paymentMethodId: string } | { method: 'new'; saveCard: boolean };

const BRANDS: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', jcb: 'JCB', diners: 'Diners Club', unionpay: 'UnionPay' };

export function cardLabel(card: Pick<BillingCard, 'brand' | 'last4' | 'expMonth' | 'expYear'>): string {
  const brand = BRANDS[card.brand.toLowerCase()] ?? (card.brand ? card.brand[0].toUpperCase() + card.brand.slice(1) : 'Card');
  return `${brand} •••• ${card.last4} · exp ${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`;
}

export const usableCards = (cards: BillingCard[]) => cards.filter(card => !card.expired && /^\d{4}$/.test(card.last4));

export function domainOrderStatusLabel(status: string): string {
  switch (status) {
    case 'registered': return 'Purchased';
    case 'registration_pending': case 'registering': case 'paid': return 'Paid · registering';
    case 'checkout_open': return 'Checkout not finished';
    case 'checkout_pending': return 'Preparing checkout';
    case 'action_required': return 'Needs review';
    case 'failed': return 'Not completed';
    default: return 'Processing';
  }
}

export function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

/** A saved card is offered only when it is still in the member's current usable list. */
export function paymentChoiceFor(selection: string, saveNewCard: boolean, cards: BillingCard[]): DomainPaymentChoice {
  if (selection !== 'new' && usableCards(cards).some(card => card.id === selection)) return { method: 'saved', paymentMethodId: selection };
  return { method: 'new', saveCard: saveNewCard };
}

export function takeSetupSessionFromSearch(search: string): { sessionId: string | null; rest: string } {
  const params = new URLSearchParams(search);
  const raw = params.get('setup_session');
  params.delete('setup_session');
  params.delete('setup');
  const rest = params.toString();
  return { sessionId: raw && /^cs_live_[A-Za-z0-9]+$/.test(raw) ? raw : null, rest: rest ? `?${rest}` : '' };
}

export function isStripeCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com'; }
  catch { return false; }
}
