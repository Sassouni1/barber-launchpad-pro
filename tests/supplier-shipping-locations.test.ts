import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { changeExtraPackage, extraPackages, reopenTrackingDetails } from '../supabase/functions/_shared/supplierTracking.ts';
import { shippingLocationUpdate, shippingLocations } from '../supabase/functions/_shared/supplierShippingLocations.ts';
import { publicOrderDetails } from '../supabase/functions/newtimes-orders/projection.ts';
import { supplierOrderSection } from '../supabase/functions/_shared/supplierOrderLifecycle.ts';

const first = '2026-10-26T12:00:00Z';
const second = '2026-10-28T12:00:00Z';
const order = (patch: ReturnType<typeof shippingLocationUpdate>) => ({
  ...patch, tracking_number: 'FIRST123', updated_at: first, order_date: first,
});

describe('warehouse tracking flow', () => {
  it('completes a one-location order after first tracking', () => {
    const patch = shippingLocationUpdate({}, 'FIRST123', 'DHL', 'one', first);
    assert.equal(patch.status, 'shipped');
    assert.equal(shippingLocations(patch.order_details), 'one');
    assert.equal(supplierOrderSection(order(patch), Date.parse(first)), 'completed');
  });

  it('waits for a second package even when its tracking arrives days later', () => {
    const firstPatch = shippingLocationUpdate({}, 'FIRST123', 'DHL', 'two', first);
    assert.equal(firstPatch.status, 'processing');
    assert.equal(supplierOrderSection(order(firstPatch), Date.parse(second)), 'current');
    const details = changeExtraPackage(firstPatch.order_details, 'FIRST123', {
      action: 'add_additional_tracking', trackingNumber: 'SECOND123', carrier: 'FedEx',
    }, second);
    const secondPatch = shippingLocationUpdate(details, 'FIRST123', 'DHL', 'two', second);
    assert.equal(secondPatch.status, 'shipped');
    assert.equal(secondPatch.order_details.supplier_completed_at, second);
    assert.equal(supplierOrderSection(order(secondPatch), Date.parse(second)), 'completed');
    const removed = changeExtraPackage(secondPatch.order_details, 'FIRST123', {
      action: 'remove_additional_tracking', originalNumber: 'SECOND123',
    }, second);
    assert.equal(shippingLocationUpdate(removed, 'FIRST123', 'DHL', 'two', second).status, 'processing');
  });

  it('accepts Other as the second carrier and completes after its tracking is saved', () => {
    const firstPatch = shippingLocationUpdate({}, 'FIRST123', 'DHL', 'two', first);
    assert.equal(firstPatch.status, 'processing');
    const details = changeExtraPackage(firstPatch.order_details, 'FIRST123', {
      action: 'add_additional_tracking', trackingNumber: 'OTHER456', carrier: 'Other', trackingUrl: 'https://carrier.example/track/OTHER456',
    }, second);
    assert.equal(extraPackages(details)[0].tracking_url, 'https://carrier.example/track/OTHER456');
    assert.equal((publicOrderDetails(details).supplier_additional_tracking as Array<{ tracking_url: string }>)[0].tracking_url, 'https://carrier.example/track/OTHER456');
    const secondPatch = shippingLocationUpdate(details, 'FIRST123', 'DHL', 'two', second);
    assert.equal(secondPatch.status, 'shipped');
    assert.equal(supplierOrderSection(order(secondPatch), Date.parse(second)), 'completed');
  });

  it('requires an HTTPS tracking link for an Other package', () => {
    assert.throws(() => changeExtraPackage({}, 'FIRST123', {
      action: 'add_additional_tracking', trackingNumber: 'OTHER456', carrier: 'Other',
    }, second), /HTTPS tracking link/);
    assert.throws(() => changeExtraPackage({}, 'FIRST123', {
      action: 'add_additional_tracking', trackingNumber: 'OTHER456', carrier: 'Other', trackingUrl: 'javascript:alert(1)',
    }, second), /HTTPS tracking link/);
  });

  it('can switch to two locations after first tracking and projects only the choice', () => {
    const single = shippingLocationUpdate({}, 'FIRST123', 'FedEx', 'one', first);
    const both = shippingLocationUpdate(single.order_details, 'FIRST123', 'FedEx', 'two', second);
    assert.equal(both.status, 'processing');
    assert.equal(both.order_details.supplier_completed_at, undefined);
    assert.equal(publicOrderDetails({ ...both.order_details, secret: 'private' }).supplier_shipping_locations, 'two');
    assert.equal(publicOrderDetails({ ...both.order_details, secret: 'private' }).secret, undefined);
  });

  it('resets two-location shipping when tracking is reopened, then accepts one-location tracking', () => {
    const waiting = shippingLocationUpdate({}, 'FIRST123', 'DHL', 'two', first);
    const reopened = reopenTrackingDetails(waiting.order_details, 'FIRST123', 'https://www.dhl.com/', second, 'Correction');
    assert.equal(shippingLocations(reopened), null);
    assert.equal(extraPackages(reopened).length, 0);
    const next = shippingLocationUpdate(reopened, 'FIXED123', 'DHL', 'one', second);
    assert.equal(next.status, 'shipped');
    assert.equal(shippingLocations(next.order_details), 'one');
    assert.equal((next.order_details.supplier_reopen_history as unknown[]).length, 1);
  });
});
