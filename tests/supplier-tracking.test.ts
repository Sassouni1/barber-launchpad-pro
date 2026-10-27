import { describe, it, expect } from 'bun:test';
import { ADDITIONAL_TRACKING_KEY, changeExtraPackage, extraPackages, reopenTrackingDetails, ensurePrimaryUnique } from '../supabase/functions/_shared/supplierTracking';
import { publicOrderDetails } from '../supabase/functions/newtimes-orders/projection';

const now = '2026-10-27T02:00:00.000Z';
const add = (raw: unknown, number: string, carrier: 'DHL' | 'FedEx' | 'Other' = 'DHL') => changeExtraPackage(raw, 'PRIMARY123', { action: 'add_additional_tracking', trackingNumber: number, carrier, supplierName: 'Supplier Two' }, now);
describe('additional supplier tracking', () => {
  it('preserves the legacy primary archive clock before extra-package writes change updated_at', () => {
    const d = changeExtraPackage({}, 'PRIMARY123', { action: 'add_additional_tracking', trackingNumber: 'SECOND123', carrier: 'DHL' }, now, '2026-10-20T00:00:00Z');
    expect(d.supplier_tracking_added_at).toBe('2026-10-20T00:00:00Z');
  });
  it('adds second and third packages without changing primary clock or private data', () => {
    const raw = { supplier_tracking_added_at: '2026-10-21', privateGHL: { secret: 'internal' } };
    const d = add(add(raw, 'SECOND123'), 'THIRD123', 'FedEx');
    expect(extraPackages(d).map(p => p.tracking_number)).toEqual(['SECOND123', 'THIRD123']);
    expect(d.supplier_tracking_added_at).toBe('2026-10-21');
    expect(d.privateGHL).toEqual(raw.privateGHL);
  });
  it('rejects duplicate primary and extra numbers ignoring spaces/hyphens/case', () => {
    expect(() => add({}, 'primary-123')).toThrow('already exists');
    expect(() => add(add({}, 'SECOND123'), 'second 123')).toThrow('already exists');
    expect(() => ensurePrimaryUnique(add({}, 'SECOND123'), 'SECOND123')).toThrow('already exists');
  });
  it('corrects and removes only the identified extra package', () => {
    const d = add(add({}, 'SECOND123'), 'THIRD123');
    const edited = changeExtraPackage(d, 'PRIMARY123', { action: 'edit_additional_tracking', originalNumber: 'SECOND123', trackingNumber: 'FIXED123', carrier: 'FedEx', supplierName: 'Second supplier' }, '2026-10-28T00:00:00Z');
    expect(extraPackages(edited)[0]).toEqual({ tracking_number: 'FIXED123', carrier: 'FedEx', supplier_name: 'Second supplier', tracking_url: 'https://www.fedex.com/fedextrack/?trknbr=FIXED123', added_at: now, updated_at: '2026-10-28T00:00:00Z' });
    const removed = changeExtraPackage(edited, 'PRIMARY123', { action: 'remove_additional_tracking', originalNumber: 'FIXED123' }, now);
    expect(extraPackages(removed).map(p => p.tracking_number)).toEqual(['THIRD123']);
  });
  it('requires primary number', () => expect(() => changeExtraPackage({}, null, { action: 'add_additional_tracking' }, now)).toThrow('primary'));
  it('validates number, carrier, supplier length and controls', () => {
    expect(() => add({}, '<script>')).toThrow();
    expect(() => add({}, 'A'.repeat(101))).toThrow();
    expect(() => changeExtraPackage({}, 'P', { action: 'add_additional_tracking', trackingNumber: 'T', carrier: 'UPS' }, now)).toThrow();
    expect(() => changeExtraPackage({}, 'P', { action: 'add_additional_tracking', trackingNumber: 'T', carrier: 'Other', supplierName: 'x'.repeat(81) }, now)).toThrow();
    expect(() => changeExtraPackage({}, 'P', { action: 'add_additional_tracking', trackingNumber: 'T', carrier: 'Other', supplierName: 'x\n' }, now)).toThrow();
  });
  it('allows 10 extras and rejects an eleventh', () => {
    let d = {};
    for (let i = 0; i < 10; i++) d = add(d, `EXTRA${i}`);
    expect(extraPackages(d)).toHaveLength(10);
    expect(() => add(d, 'ELEVENTH')).toThrow('Maximum 10');
  });
  it('Other has no invented tracking link', () => expect(extraPackages(add({}, 'SECOND', 'Other'))[0].tracking_url).toBeNull());
  it('archives all primary/extra tracking and clears active labels on reopen', () => {
    const d = add(add({ supplier_tracking_carrier: 'DHL', supplier_tracking_added_at: now, privateGHL: 'keep' }, 'SECOND123'), 'THIRD123');
    const reopened = reopenTrackingDetails(d, 'PRIMARY123', 'https://www.dhl.com/', now, 'Issue');
    expect(extraPackages(reopened)).toEqual([]);
    expect(reopened.supplier_tracking_added_at).toBeUndefined();
    expect(reopened.privateGHL).toBe('keep');
    const history = reopened.supplier_reopen_history as Array<Record<string, unknown>>;
    expect(history[0].tracking_number).toBe('PRIMARY123');
    expect((history[0].additional_tracking as unknown[]).length).toBe(2);
  });
  it('public projection allowlists active and archived package keys and regenerates links', () => {
    const dirty = { tracking_number: 'SECOND123', carrier: 'DHL', supplier_name: 'Supplier', tracking_url: 'javascript:alert(1)', added_at: now, updated_at: now, customData: 'secret', payment_reference: 'secret' };
    const projected = publicOrderDetails({ privateGHL: 'secret', order: { customData: 'secret' }, [ADDITIONAL_TRACKING_KEY]: [dirty], supplier_reopen_history: [{ tracking_number: 'OLD', privateGHL: 'secret', additional_tracking: [dirty] }] });
    expect(projected.privateGHL).toBeUndefined();
    expect(projected.order).toBeUndefined();
    const p = (projected[ADDITIONAL_TRACKING_KEY] as Array<Record<string, unknown>>)[0];
    expect(Object.keys(p).sort()).toEqual(['added_at', 'carrier', 'supplier_name', 'tracking_number', 'tracking_url', 'updated_at']);
    expect(p.tracking_url).toBe('https://www.dhl.com/us-en/home/tracking.html?submit=1&tracking-id=SECOND123');
    expect(JSON.stringify(projected)).not.toContain('secret');
  });
});