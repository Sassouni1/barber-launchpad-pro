import { COMPLETED_AT_KEY } from './supplierOrderLifecycle.ts';
import { extraPackages, objectDetails, type TrackingCarrier } from './supplierTracking.ts';

export const SHIPPING_LOCATIONS_KEY = 'supplier_shipping_locations';
export type ShippingLocations = 'one' | 'two';

export function shippingLocations(raw: unknown): ShippingLocations | null {
  const value = objectDetails(raw)[SHIPPING_LOCATIONS_KEY];
  return value === 'one' || value === 'two' ? value : null;
}

export function shipmentProgress(raw: unknown, primary: string | null, primaryCarrier: TrackingCarrier | null) {
  const carriers = new Set<TrackingCarrier>();
  if (primary && primaryCarrier) carriers.add(primaryCarrier);
  for (const item of extraPackages(raw)) carriers.add(item.carrier);
  return { china: carriers.has('DHL'), us: carriers.has('FedEx') };
}

export function shippingLocationUpdate(
  raw: unknown, primary: string | null, primaryCarrier: TrackingCarrier | null,
  mode: ShippingLocations, now: string,
) {
  const details: Record<string, unknown> = { ...objectDetails(raw), [SHIPPING_LOCATIONS_KEY]: mode };
  const { china, us } = shipmentProgress(details, primary, primaryCarrier);
  const complete = !!primary && (mode === 'one' || (china && us));
  if (complete) {
    if (!details[COMPLETED_AT_KEY]) details[COMPLETED_AT_KEY] = now;
    delete details.supplier_completion_undone_at;
  } else {
    delete details[COMPLETED_AT_KEY];
  }
  return { status: complete ? 'shipped' : 'processing', order_details: details };
}
