// Paid-checkout account creation on /create. The checkout session id only
// travels to the server, which verifies the payment with Stripe; nothing here
// decides access.

export const CHECKOUT_SESSION_KEY = 'bl_checkout_session';
const SESSION_ID = /^cs_live_[A-Za-z0-9]{10,200}$/;

export const isCheckoutSessionId = (value: unknown): value is string =>
  typeof value === 'string' && SESSION_ID.test(value.trim());

/** Reads ?session_id= (or ?checkout_session_id=) and returns the URL search without it. */
export function takeCheckoutSessionFromSearch(search: string): { sessionId: string | null; rest: string } {
  const params = new URLSearchParams(search);
  const raw = params.get('session_id') ?? params.get('checkout_session_id');
  params.delete('session_id');
  params.delete('checkout_session_id');
  const rest = params.toString();
  return { sessionId: isCheckoutSessionId(raw) ? raw!.trim() : null, rest: rest ? `?${rest}` : '' };
}

export type CheckoutProblem = 'not_verified' | 'already_claimed' | 'account_exists' | 'in_progress' | 'check_unavailable' | 'rate_limited';

export const checkoutProblemText: Record<CheckoutProblem, { title: string; body: string }> = {
  not_verified: {
    title: "We couldn't verify this payment",
    body: "If you just paid, wait a minute and try again. You can also create your account with the email you used at checkout, or contact Barber Launch Support.",
  },
  already_claimed: {
    title: 'This purchase already has an account',
    body: 'An account was already created with this purchase. Sign in with the email you chose, or reset your password from the sign-in page.',
  },
  account_exists: {
    title: 'You already have an account',
    body: 'This purchase belongs to an existing Barber Launch account. Sign in instead, or reset your password from the sign-in page.',
  },
  in_progress: {
    title: 'Your account is being created',
    body: 'An account is already being created with this purchase. Wait a minute, then sign in or try again.',
  },
  check_unavailable: {
    title: "We couldn't check your payment right now",
    body: 'Please try again in a few minutes.',
  },
  rate_limited: {
    title: 'Too many tries',
    body: 'Please wait an hour and try again, or contact Barber Launch Support.',
  },
};

export const toCheckoutProblem = (reason?: string): CheckoutProblem =>
  (reason && reason in checkoutProblemText ? reason : 'not_verified') as CheckoutProblem;
