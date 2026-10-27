import { COMPLETED_AT_KEY } from './supplierOrderLifecycle.ts';
export const ADDITIONAL_TRACKING_KEY = 'supplier_additional_tracking';
export const MAX_ADDITIONAL_PACKAGES = 10;
export type TrackingCarrier = 'DHL' | 'FedEx' | 'Other';
export type ExtraPackage = {
  tracking_number: string;
  carrier: TrackingCarrier;
  supplier_name: string;
  tracking_url: string | null;
  added_at: string;
  updated_at: string;
};
export const objectDetails = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? { ...v as Record<string, unknown> } : {};
export function trackingNumber(value: unknown): string {
  const number = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 -]{0,99}$/.test(number)) throw new Error('Enter a tracking number of 1–100 letters, digits, spaces, or hyphens.');
  return number;
}
export const numberKey = (v: string) => v.replace(/[ -]/g, '').toUpperCase();
export function trackingCarrier(value: unknown): TrackingCarrier {
  if (value !== 'DHL' && value !== 'FedEx' && value !== 'Other') throw new Error('Choose DHL, FedEx, or Other.');
  return value;
}
export function trackingUrl(number: string, carrier: TrackingCarrier): string | null {
  return carrier === 'FedEx' ? `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number)}`
    : carrier === 'DHL' ? `https://www.dhl.com/us-en/home/tracking.html?submit=1&tracking-id=${encodeURIComponent(number)}` : null;
}
export function extraPackages(raw: unknown): ExtraPackage[] {
  const value = objectDetails(raw)[ADDITIONAL_TRACKING_KEY];
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    const e = objectDetails(entry);
    try {
      const number = trackingNumber(e.tracking_number);
      const carrier = trackingCarrier(e.carrier);
      return [{ tracking_number: number, carrier, supplier_name: typeof e.supplier_name === 'string' ? e.supplier_name.slice(0, 80) : '',
        tracking_url: trackingUrl(number, carrier), added_at: typeof e.added_at === 'string' ? e.added_at : '', updated_at: typeof e.updated_at === 'string' ? e.updated_at : '' }];
    } catch { return []; }
  }).slice(0, MAX_ADDITIONAL_PACKAGES);
}
export type ExtraChange = {
  action: 'add_additional_tracking' | 'edit_additional_tracking' | 'remove_additional_tracking';
  originalNumber?: unknown;
  trackingNumber?: unknown;
  carrier?: unknown;
  supplierName?: unknown;
};
export function changeExtraPackage(raw: unknown, primary: string | null, change: ExtraChange, now: string, previousUpdatedAt?: string): Record<string, unknown> {
  if (!primary) throw new Error('Add primary tracking before additional packages.');
  const details = objectDetails(raw);
  // Legacy tracked orders without an explicit archive timestamp use updated_at.
  // Preserve that original fallback before an extra-package write updates the row.
  if (!details.supplier_tracking_added_at && previousUpdatedAt) details.supplier_tracking_added_at = previousUpdatedAt;
  const entries = extraPackages(raw);
  // Fail closed rather than silently dropping malformed/oversized internal entries.
  const stored = details[ADDITIONAL_TRACKING_KEY];
  if (stored !== undefined && (!Array.isArray(stored) || stored.length !== entries.length)) throw new Error('Stored package tracking needs admin review.');
  const original = change.action === 'add_additional_tracking' ? '' : trackingNumber(change.originalNumber);
  const index = entries.findIndex(e => numberKey(e.tracking_number) === numberKey(original));
  if (change.action !== 'add_additional_tracking' && index < 0) throw new Error('Package changed or was removed. Refresh and try again.');
  if (change.action === 'remove_additional_tracking') entries.splice(index, 1);
  else {
    const number = trackingNumber(change.trackingNumber);
    const carrier = trackingCarrier(change.carrier);
    const supplier = change.supplierName === undefined ? '' : change.supplierName;
    if (typeof supplier !== 'string' || supplier.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(supplier)) throw new Error('Supplier name must be at most 80 characters with no control characters.');
    if (numberKey(primary) === numberKey(number) || entries.some((e, i) => i !== index && numberKey(e.tracking_number) === numberKey(number))) throw new Error('That tracking number already exists on this order.');
    if (change.action === 'add_additional_tracking' && entries.length >= MAX_ADDITIONAL_PACKAGES) throw new Error('Maximum 10 additional packages per order.');
    const entry = { tracking_number: number, carrier, supplier_name: supplier.trim(), tracking_url: trackingUrl(number, carrier), added_at: index < 0 ? now : entries[index].added_at, updated_at: now };
    if (index < 0) entries.push(entry); else entries[index] = entry;
  }
  return { ...details, [ADDITIONAL_TRACKING_KEY]: entries };
}
export function ensurePrimaryUnique(raw: unknown, number: string) {
  if (extraPackages(raw).some(e => numberKey(e.tracking_number) === numberKey(number))) throw new Error('That tracking number already exists as an additional package.');
}
export function reopenTrackingDetails(raw: unknown, primary: string, url: string | null, now: string, note: string): Record<string, unknown> {
  const details = objectDetails(raw);
  const history = Array.isArray(details.supplier_reopen_history) ? details.supplier_reopen_history : [];
  details.supplier_reopen_history = [...history, { tracking_number: primary, tracking_url: url, carrier: details.supplier_tracking_carrier || null,
    additional_tracking: extraPackages(raw), reopened_at: now, note }];
  delete details.supplier_tracking_added_at;
  delete details.supplier_tracking_carrier;
  delete details[ADDITIONAL_TRACKING_KEY];
  delete details[COMPLETED_AT_KEY];
  delete details.supplier_completion_undone_at;
  delete details.supplier_shipment_previously_completed;
  return details;
}