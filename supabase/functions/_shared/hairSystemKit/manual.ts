import { KIT_ITEMS } from './logic.ts';

export type ManualKitInput = {
  request_key: string; name: string; email: string; phone: string;
  shipping: { address1: string; address2: string; city: string; state: string; postal_code: string; country: string };
  kit_notes: string; reason: string; address_evidence: string; shipping_confirmed: true;
};

export async function authorizeKitAdmin(authHeader: string | null,
  readUser: (token: string) => Promise<string | null>, readAdmin: (userId: string) => Promise<boolean>) {
  if (!authHeader?.startsWith('Bearer ') || !authHeader.slice(7)) return { ok: false as const, status: 401 };
  let userId: string | null;
  try { userId = await readUser(authHeader.slice(7)); } catch { return { ok: false as const, status: 401 }; }
  if (!userId) return { ok: false as const, status: 401 };
  try { if (!await readAdmin(userId)) return { ok: false as const, status: 403 }; }
  catch { return { ok: false as const, status: 403 }; }
  return { ok: true as const, userId };
}

export const manualEmailKey = (email: string) => email.trim().toLowerCase();
export const manualPhoneKey = (phone: string) => phone.replace(/\D/g, '');
export const manualExternalReference = (requestKey: string) => `manual-kit:${requestKey}`;
export async function manualIdentityKey(input: Pick<ManualKitInput, 'email' | 'phone'>) {
  const bytes = new TextEncoder().encode(`${manualEmailKey(input.email)}\n${manualPhoneKey(input.phone)}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, v => v.toString(16).padStart(2, '0')).join('');
}

export function validateManualKit(input: ManualKitInput): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.request_key)) return 'invalid_request_key';
  if (!input.name.trim() || input.name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manualEmailKey(input.email)) ||
    input.email.length > 254 || manualPhoneKey(input.phone).length < 10 || manualPhoneKey(input.phone).length > 15 || input.phone.length > 40)
    return 'customer_details_incomplete';
  const s = input.shipping;
  if ([s.address1, s.city, s.state, s.postal_code, s.country].some(v => !v.trim() || v.length > 120) ||
    s.address2.length > 120 || !/^[0-9]{5}(?:-[0-9]{4})?$/.test(s.postal_code.trim()) || s.country.trim().toUpperCase() !== 'US')
    return 'shipping_incomplete';
  if (input.shipping_confirmed !== true || input.reason.length > 1000 ||
    input.address_evidence.length > 1000 || input.kit_notes.length > 2000)
    return 'manual_confirmation_missing';
  if (KIT_ITEMS.length !== 6) return 'kit_manifest_invalid';
  return null;
}

export function manualFacts(input: ManualKitInput, identityKey: string) {
  return { request_key: input.request_key, name: input.name, email: input.email, phone: input.phone,
    shipping: input.shipping, kit_notes: input.kit_notes, reason: input.reason,
    address_evidence: input.address_evidence, shipping_confirmed: input.shipping_confirmed,
    identity_key: identityKey, external_reference: manualExternalReference(input.request_key),
    kit_items: KIT_ITEMS, supplier: 'sales30@newtimeshair.com', supplier_subject: 'New Hair System Kit Order' };
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}
export function manualKitEmail(input: ManualKitInput, rowId: string) {
  const s = input.shipping;
  const address = [s.address1, s.address2, s.city, s.state, s.postal_code, s.country].filter(Boolean).join(', ');
  const link = `https://member.thebarberlaunch.com/newtimes?order=${encodeURIComponent(rowId)}`;
  const notes = input.kit_notes.trim() ? `<p>Kit notes: ${escapeHtml(input.kit_notes)}</p>` : '';
  return { role: 'supplier', to: 'sales30@newtimeshair.com', subject: 'New Hair System Kit Order',
    html: `<p>New order for ${escapeHtml(input.name)} at ${escapeHtml(address)}.</p>${notes}<p><a href="${escapeHtml(link)}">Click here to view order and add tracking details.</a></p>` };
}

export function manualOrderRow(input: ManualKitInput, adminId: string, identityKey: string) {
  const facts = manualFacts(input, identityKey);
  return { external_order_id: facts.external_reference, user_id: null, customer_name: input.name,
    customer_email: input.email, payment_reference: null, status: 'pending', order_date: new Date().toISOString(),
    order_details: { supplier_kit: true, manual_source: 'admin_entry', manual_identity_key: identityKey,
      manual_request_key: input.request_key, manual_admin_id: adminId, manual_facts: facts,
      full_name: input.name, phone: input.phone, shipping_address: { name: input.name, ...input.shipping },
      kit_notes: input.kit_notes, notes: input.kit_notes,
      order: { line_items: KIT_ITEMS.map(title => ({ title, quantity: 1 })) } } };
}
