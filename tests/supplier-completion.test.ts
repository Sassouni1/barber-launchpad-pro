import { describe, it, expect } from 'bun:test';
import { completionUpdate, supplierOrderSection, preserveCompletionClock, trackingSaveStatus, ARCHIVE_DELAY_MS } from '../supabase/functions/_shared/supplierOrderLifecycle';
import { changeExtraPackage, reopenTrackingDetails } from '../supabase/functions/_shared/supplierTracking';
const now = Date.parse('2026-10-27T02:00:00Z');
const order = { status: 'processing', tracking_number: 'PRIMARY123', updated_at: '2026-10-22T00:00:00Z', order_date: '2026-10-22T00:00:00Z', tracking_seen: false, order_details: { supplier_tracking_added_at: '2026-10-22T00:00:00Z' } };
describe('supplier explicit completion', () => {
  it('first tracking keeps working status and never archives on elapsed tracking time', () => {
    expect(trackingSaveStatus('pending')).toBe('processing');
    expect(trackingSaveStatus('processing')).toBe('processing');
    expect(supplierOrderSection(order, now + 100 * ARCHIVE_DELAY_MS)).toBe('current');
  });
  it('requires tracking before Completed', () => expect(() => completionUpdate({ ...order, tracking_number: null }, true, new Date(now).toISOString())).toThrow('tracking number'));
  it('completion sets shipped and starts exactly eight days from completion', () => {
    const completed = { ...order, ...completionUpdate(order, true, new Date(now).toISOString()) };
    expect(completed.status).toBe('shipped');
    expect(supplierOrderSection(completed, now + ARCHIVE_DELAY_MS - 1)).toBe('completed');
    expect(supplierOrderSection(completed, now + ARCHIVE_DELAY_MS)).toBe('past');
  });
  it('undo preserves tracking, returns Current and recompletion suppresses repeated notice', () => {
    const completed = { ...order, ...completionUpdate(order, true, new Date(now).toISOString()) };
    const undone = { ...completed, ...completionUpdate(completed, false, new Date(now + 1).toISOString()) };
    expect(undone.tracking_number).toBe('PRIMARY123');
    expect(supplierOrderSection(undone, now + 100 * ARCHIVE_DELAY_MS)).toBe('current');
    expect(completionUpdate(undone, true, new Date(now + 2).toISOString()).tracking_seen).toBe(true);
  });
  it('legacy shipped orders stay completed; late tracking edits preserve archive time', () => {
    const legacy = { ...order, status: 'shipped' };
    expect(supplierOrderSection(legacy, now)).toBe('completed');
    expect(trackingSaveStatus('shipped')).toBe('shipped');
    const details = changeExtraPackage(preserveCompletionClock(legacy), legacy.tracking_number, { action: 'add_additional_tracking', trackingNumber: 'SECOND123', carrier: 'FedEx' }, new Date(now).toISOString());
    expect(details.supplier_completed_at).toBe('2026-10-22T00:00:00Z');
    expect(supplierOrderSection({ ...legacy, order_details: details, updated_at: new Date(now).toISOString() }, Date.parse('2026-10-30T00:00:00Z'))).toBe('past');
  });
  it('reopen clears completion and active tracking history stays retained', () => {
    const completed = completionUpdate(order, true, new Date(now).toISOString());
    const details = reopenTrackingDetails(completed.order_details, 'PRIMARY123', null, new Date(now).toISOString(), 'Issue');
    expect(details.supplier_completed_at).toBeUndefined();
    expect(details.supplier_completion_undone_at).toBeUndefined();
    expect((details.supplier_reopen_history as Array<Record<string, unknown>>)[0].tracking_number).toBe('PRIMARY123');
  });
});