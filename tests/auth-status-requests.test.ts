import { expect, test } from 'bun:test';
import { AuthStatusRequests } from '../src/lib/authStatusRequests';

test('same-user refresh preserves resolved access instead of blocking training', () => {
  const reads = new AuthStatusRequests();
  reads.activate('member');
  reads.resolve(reads.begin('member'));
  expect(reads.activate('member')).toBe(false);
  reads.begin('member');
  expect(reads.hasResolved).toBe(true);
});

test('a slower old request cannot overwrite newer status', () => {
  const reads = new AuthStatusRequests();
  reads.activate('member');
  const old = reads.begin('member');
  const recent = reads.begin('member');
  expect(reads.resolve(old)).toBe(false);
  expect(reads.resolve(recent)).toBe(true);
});

test('sign-out discards outstanding reads and resolved access', () => {
  const reads = new AuthStatusRequests();
  reads.activate('member');
  const pending = reads.begin('member');
  reads.activate(null);
  expect(reads.resolve(pending)).toBe(false);
  expect(reads.hasResolved).toBe(false);
});

test('another user never inherits resolved role status', () => {
  const reads = new AuthStatusRequests();
  reads.activate('admin');
  const old = reads.begin('admin');
  reads.resolve(old);
  reads.activate('member');
  expect(reads.hasResolved).toBe(false);
  expect(reads.isCurrent(old)).toBe(false);
});