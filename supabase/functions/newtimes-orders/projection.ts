import { ADDITIONAL_TRACKING_KEY, extraPackages } from '../_shared/supplierTracking.ts';
const TRACKING_ADDED_AT_KEY = 'supplier_tracking_added_at';
const TRACKING_CARRIER_KEY = 'supplier_tracking_carrier';
const REOPEN_HISTORY_KEY = 'supplier_reopen_history';
const asObject = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
// Strict allowlist: a freshly built object with only fields /newtimes displays. Never raw nested order/GHL data.
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);
const TOP_TEXT = ['order_type', 'full_name', 'name', 'phone', 'notes', 'supplier_completed_at', 'supplier_completion_undone_at', TRACKING_ADDED_AT_KEY, TRACKING_CARRIER_KEY,
  'Choose Color', 'Hair Color', 'Lace or Skin', 'Hair Length', 'Choose Density', 'Choose Density if Needed (75%-110%) - 100% is regular',
  'Curl Pattern', 'Curl Pattern — only if needed', 'Hair Salon Service Requested'];
const ADDRESS_KEYS = ['name', 'address_1', 'address_2', 'address1', 'address2', 'city', 'state', 'zip', 'postal_code', 'country', 'method'];
function pickText(src: Record<string, unknown>, keys: string[]) {
  const out: Record<string, string> = {};
  for (const k of keys) { const v = str(src[k]); if (v !== undefined) out[k] = v; }
  return out;
}
export function publicOrderDetails(raw: unknown): Record<string, unknown> {
  const d = asObject(raw);
  const nested = asObject(d.order);
  const out: Record<string, unknown> = pickText(d, TOP_TEXT);
  if (d.kit_order === true) out.kit_order = true;
  if (d.supplier_kit === true) out.supplier_kit = true;
  for (const k of ['order_number', 'total_orders']) if (typeof d[k] === 'number' || typeof d[k] === 'string') out[k] = d[k];
  if (out.phone === undefined) { const p = str(asObject(nested.customer).phone); if (p) out.phone = p; }
  for (const k of ['shipping', 'shipping_address']) if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) out[k] = pickText(asObject(d[k]), ADDRESS_KEYS);
  const items = Array.isArray(nested.line_items) ? nested.line_items : Array.isArray(d.line_items) ? d.line_items : null;
  if (items) out.line_items = items.map((i) => { const o = asObject(i); const r: Record<string, unknown> = { title: str(o.title) ?? '' }; if (typeof o.quantity === 'number') r.quantity = o.quantity; return r; });
  if (Array.isArray(d[ADDITIONAL_TRACKING_KEY])) out[ADDITIONAL_TRACKING_KEY] = extraPackages(d);
  if (Array.isArray(d[REOPEN_HISTORY_KEY])) out[REOPEN_HISTORY_KEY] = (d[REOPEN_HISTORY_KEY] as unknown[]).map((h) => {
    const entry = asObject(h);
    return { ...pickText(entry, ['tracking_number', 'tracking_url', 'carrier', 'reopened_at', 'note']),
      additional_tracking: extraPackages({ [ADDITIONAL_TRACKING_KEY]: entry.additional_tracking }) };
  });
  return out;
}

