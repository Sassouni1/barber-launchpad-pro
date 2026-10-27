import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { changeExtraPackage } from '../supabase/functions/_shared/supplierTracking.ts';
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

  it('waits for both China DHL and US FedEx tracking even when the second arrives days later', () => {
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

  it('can switch to two locations after first tracking and projects only the choice', () => {
    const single = shippingLocationUpdate({}, 'FIRST123', 'FedEx', 'one', first);
    const both = shippingLocationUpdate(single.order_details, 'FIRST123', 'FedEx', 'two', second);
    assert.equal(both.status, 'processing');
    assert.equal(both.order_details.supplier_completed_at, undefined);
    assert.equal(publicOrderDetails({ ...both.order_details, secret: 'private' }).supplier_shipping_locations, 'two');
    assert.equal(publicOrderDetails({ ...both.order_details, secret: 'private' }).secret, undefined);
  });
});
