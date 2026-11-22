import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCheckoutSessionId, takeCheckoutSessionFromSearch, toCheckoutProblem } from './checkoutSignup.ts';

test('only live checkout session ids are used', () => {
  assert.equal(isCheckoutSessionId('cs_live_a1B2c3D4e5F6g7H8'), true);
  assert.equal(isCheckoutSessionId('cs_test_a1B2c3D4e5F6g7H8'), false);
  assert.equal(isCheckoutSessionId('cs_live_<script>'), false);
});

test('the session id is removed from the address after reading', () => {
  assert.deepEqual(takeCheckoutSessionFromSearch('?session_id=cs_live_a1B2c3D4e5F6g7H8&ref=x'), { sessionId: 'cs_live_a1B2c3D4e5F6g7H8', rest: '?ref=x' });
  assert.deepEqual(takeCheckoutSessionFromSearch('?session_id=cs_test_a1B2c3D4e5F6g7H8'), { sessionId: null, rest: '' });
  assert.deepEqual(takeCheckoutSessionFromSearch(''), { sessionId: null, rest: '' });
});

test('unknown server answers are treated as not verified', () => {
  assert.equal(toCheckoutProblem('already_claimed'), 'already_claimed');
  assert.equal(toCheckoutProblem('weird'), 'not_verified');
  assert.equal(toCheckoutProblem(undefined), 'not_verified');
});
