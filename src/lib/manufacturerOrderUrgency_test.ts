import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNewOrderOverdue } from './manufacturerOrderUrgency.ts';

const at = (value: string) => Date.parse(value);

test('new order turns overdue after 48 weekday hours in China', () => {
  // Monday 09:00 to Wednesday 09:00 in Shanghai.
  const order = '2026-10-26T01:00:00Z';
  assert.equal(isNewOrderOverdue(order, at('2026-10-28T00:59:59Z')), false);
  assert.equal(isNewOrderOverdue(order, at('2026-10-28T01:00:00Z')), true);
});

test('China Saturday and Sunday do not count toward the deadline', () => {
  // Friday 09:00 to Tuesday 09:00 in Shanghai.
  const order = '2026-10-30T01:00:00Z';
  assert.equal(isNewOrderOverdue(order, at('2026-11-02T01:00:00Z')), false);
  assert.equal(isNewOrderOverdue(order, at('2026-11-03T00:59:59Z')), false);
  assert.equal(isNewOrderOverdue(order, at('2026-11-03T01:00:00Z')), true);
});

test('orders placed on a China weekend begin aging Monday', () => {
  const order = '2026-10-31T01:00:00Z'; // Saturday 09:00 in Shanghai
  assert.equal(isNewOrderOverdue(order, at('2026-11-03T15:59:59Z')), false);
  assert.equal(isNewOrderOverdue(order, at('2026-11-03T16:00:00Z')), true);
});
