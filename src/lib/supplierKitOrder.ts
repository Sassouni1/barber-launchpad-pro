export const KIT_MANIFEST = [
  { title: '1 #2 skin system', quantity: 1 },
  { title: '1 #2 lace system', quantity: 1 },
  { title: 'color wheel', quantity: 1 },
  { title: 'adhesive', quantity: 1 },
  { title: 'tape', quantity: 1 },
  { title: 'C22 spray', quantity: 1 },
] as const;

export function supplierOrderSelected(order: { external_order_id: string | null }, reference: string | null) {
  return reference === null || order.external_order_id === reference;
}

export function kitShippingLines(details: Record<string, unknown> | null): string[] {
  if (details?.supplier_kit !== true) return [];
  const s = details.shipping_address;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return [];
  const address = s as Record<string, unknown>;
  return ['name', 'address1', 'address2', 'city', 'state', 'postal_code', 'country']
    .map(key => typeof address[key] === 'string' ? String(address[key]).trim() : '')
    .filter(Boolean);
}