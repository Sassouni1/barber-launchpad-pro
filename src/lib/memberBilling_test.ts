import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardLabel, domainOrderStatusLabel, isStripeCheckoutUrl, paymentChoiceFor, takeSetupSessionFromSearch, type BillingCard } from './memberBilling.ts';

const card = (over: Partial<BillingCard> = {}): BillingCard => ({ id: 'pm_ok', brand: 'visa', last4: '4242', expMonth: 4, expYear: 2028, expired: false, isDefault: false, redisplay: 'unspecified', ...over });

test('a saved card is used only when it is still a usable card of this member', () => {
  assert.deepEqual(paymentChoiceFor('pm_ok', true, [card()]), { method: 'saved', paymentMethodId: 'pm_ok' });
  assert.deepEqual(paymentChoiceFor('pm_ok', false, [card({ expired: true })]), { method: 'new', saveCard: false });
  assert.deepEqual(paymentChoiceFor('pm_gone', true, [card()]), { method: 'new', saveCard: true });
  assert.deepEqual(paymentChoiceFor('new', false, [card()]), { method: 'new', saveCard: false });
});

test('cards show only brand, last four and expiry', () => {
  assert.equal(cardLabel(card()), 'Visa •••• 4242 · exp 04/28');
});

test('only live Stripe setup sessions are read, and the address is cleaned', () => {
  assert.deepEqual(takeSetupSessionFromSearch('?setup_session=cs_live_abc123&x=1'), { sessionId: 'cs_live_abc123', rest: '?x=1' });
  assert.deepEqual(takeSetupSessionFromSearch('?setup_session=cs_test_abc'), { sessionId: null, rest: '' });
});

test('only Stripe-hosted checkout addresses are opened', () => {
  assert.equal(isStripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_live_1'), true);
  assert.equal(isStripeCheckoutUrl('https://checkout.stripe.com.evil.io/x'), false);
  assert.equal(isStripeCheckoutUrl('http://checkout.stripe.com/x'), false);
});

test('a paid order waiting on Cloudflare never reads as purchased', () => {
  assert.equal(domainOrderStatusLabel('registration_pending'), 'Paid · registering');
  assert.equal(domainOrderStatusLabel('registered'), 'Purchased');
  assert.equal(domainOrderStatusLabel('action_required'), 'Needs review');
});
