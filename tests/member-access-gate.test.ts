import { describe, expect, test } from 'bun:test';
import { memberGate } from '../src/lib/memberAccessGate';

const off = { enforced: false, hasAccess: false, allowed: true };
const onNoAccess = { enforced: true, hasAccess: false, allowed: false };
const onPaid = { enforced: true, hasAccess: true, allowed: true };

describe('member access gate', () => {
  test('a new unpaid sign-up sees access pending once the switch is on', () => {
    expect(memberGate({ isAdmin: false, isManufacturer: false, access: onNoAccess })).toBe('pending');
  });
  test('a verified paid member gets in', () => {
    expect(memberGate({ isAdmin: false, isManufacturer: false, access: onPaid })).toBe('allow');
  });
  test('while the switch is off every signed-in account keeps access', () => {
    expect(memberGate({ isAdmin: false, isManufacturer: false, access: off })).toBe('allow');
  });
  test('admins always get in', () => {
    expect(memberGate({ isAdmin: true, isManufacturer: false, access: onNoAccess })).toBe('allow');
  });
  test('an unknown access answer never opens member pages', () => {
    expect(memberGate({ isAdmin: false, isManufacturer: false, access: null })).toBe('pending');
  });
});
