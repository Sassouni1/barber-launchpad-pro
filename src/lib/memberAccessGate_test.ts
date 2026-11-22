import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memberGate } from './memberAccessGate.ts';

const access = (allowed: boolean) => ({ enforced: false, hasAccess: false, legacy: allowed, allowed });

test('existing account the server allows (no purchase matched) opens member pages', () => {
  assert.equal(memberGate({ isAdmin: false, access: access(true) }), 'allow');
});

test('account the server denies sees access pending', () => {
  assert.equal(memberGate({ isAdmin: false, access: access(false) }), 'pending');
});

test('unknown access status never opens member pages', () => {
  assert.equal(memberGate({ isAdmin: false, access: null }), 'pending');
});

test('admins always open member pages', () => {
  assert.equal(memberGate({ isAdmin: true, access: null }), 'allow');
});
