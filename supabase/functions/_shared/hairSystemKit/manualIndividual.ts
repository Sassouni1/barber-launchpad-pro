import { buildSupplierEmailHtml, DEFAULT_SUPPLIER_EMAIL, SUPPLIER_SUBJECT } from '../hairSystemNotifications.ts';
import { canonicalJson } from './manual.ts';

export type IndividualInput = {
  request_key: string; name: string; email: string; phone: string;
  shipping: { address1: string; address2: string; city: string; state: string; postal_code: string; country: string };
  item: string; variant: string; quantity: number; supplier_cost_cents: number | null;
  notes: string; shipping_confirmed: true; repeat_of_order_id: string | null; repeat_confirmed: boolean;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalized = (value: string) => value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
export function validateIndividual(input: IndividualInput): string | null {
  if (!uuid.test(input.request_key) || (input.repeat_of_order_id !== null && !uuid.test(input.repeat_of_order_id))) return 'invalid_request_key';
  if (!input.name.trim() || input.name.length > 120 || input.email.length > 254 ||
    (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) ||
    input.phone.length > 40 || (input.phone.trim() && !/^\+?[0-9 ()-]{7,40}$/.test(input.phone))) return 'customer_details_invalid';
  const s = input.shipping;
  if ([s.address1, s.city, s.state, s.postal_code, s.country].some(v => !v.trim() || v.length > 120) ||
    s.address2.length > 120 || !/^[0-9]{5}(?:-[0-9]{4})?$/.test(s.postal_code.trim()) || s.country.trim().toUpperCase() !== 'US') return 'shipping_incomplete';
  if (!input.item.trim() || !/\bskin\b/i.test(input.item) || !input.variant.trim() || input.item.length > 240 || input.variant.length > 240 ||
    !Number.isSafeInteger(input.quantity) || input.quantity !== 1 || input.notes.length > 2000) return 'individual_details_invalid';
  if (input.supplier_cost_cents !== null && (!Number.isSafeInteger(input.supplier_cost_cents) || input.supplier_cost_cents < 0 || input.supplier_cost_cents > 1_000_000)) return 'cost_invalid';
  if (input.shipping_confirmed !== true || Boolean(input.repeat_of_order_id) !== input.repeat_confirmed) return 'confirmation_missing';
  return null;
}
export async function individualFingerprint(input: IndividualInput) {
  const s = input.shipping;
  const stable = [input.name, s.address1, s.address2, s.city, s.state, s.postal_code, s.country,
    input.item, input.variant, String(input.quantity)].map(normalized).join('\n');
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable)));
  return Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
}
export function individualFacts(input: IndividualInput, fingerprint: string) {
  return { request_key: input.request_key, name: input.name, email: input.email, phone: input.phone,
    shipping: input.shipping, item: input.item, variant: input.variant, quantity: input.quantity,
    supplier_cost_cents: input.supplier_cost_cents, notes: input.notes,
    shipping_confirmed: input.shipping_confirmed, repeat_of_order_id: input.repeat_of_order_id,
    repeat_confirmed: input.repeat_confirmed, fingerprint,
    external_reference: `manual-individual:${input.request_key}`,
    supplier: DEFAULT_SUPPLIER_EMAIL, supplier_subject: SUPPLIER_SUBJECT };
}
export function individualRow(input: IndividualInput, adminId: string, fingerprint: string) {
  const facts = individualFacts(input, fingerprint);
  return { external_order_id: facts.external_reference, user_id: null, customer_name: input.name,
    customer_email: input.email, payment_reference: null, status: 'pending', order_date: new Date().toISOString(),
    order_details: { manual_source: 'admin_entry', manual_individual: true, supplier_kit: false,
      manual_identity_key: fingerprint, manual_request_key: input.request_key, manual_admin_id: adminId,
      manual_facts: facts, full_name: input.name, phone: input.phone,
      shipping_address: { name: input.name, ...input.shipping }, notes: input.notes,
      'Lace or Skin': 'Skin', 'Choose Color': input.variant,
      individual_item: input.item, individual_variant: input.variant, quantity: input.quantity,
      manual_supplier_cost_cents: input.supplier_cost_cents,
      order: { line_items: [{ title: `${input.item} — ${input.variant}`, quantity: input.quantity }] } } };
}
export function individualEmail(input: IndividualInput, rowId: string) {
  const row = individualRow(input, 'email-only', 'email-only');
  const s = input.shipping;
  const html = buildSupplierEmailHtml({ id: rowId, customer_name: input.name, customer_email: input.email,
    order_details: row.order_details }, { name: input.name, email: input.email, phone: input.phone,
    address: [s.address1, s.address2, `${s.city}, ${s.state}`, s.postal_code, s.country].filter(Boolean) });
  const esc = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch] ?? ch));
  const detail = `<p>One hair system: ${esc(input.item)} — ${esc(input.variant)}. Quantity: ${input.quantity}.</p>${input.notes ? `<p>Supplier notes: ${esc(input.notes)}</p>` : ''}`;
  return { role: 'supplier', to: DEFAULT_SUPPLIER_EMAIL, subject: SUPPLIER_SUBJECT,
    html: html.replace('</body>', `${detail}</body>`) };
}
export { canonicalJson };
