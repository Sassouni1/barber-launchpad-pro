// Supplier-facing projection of stored order details. Keep this whitelist
// separate from payment snapshots, internal client names, and raw GHL payloads.

type Data = Record<string, unknown>;
const obj = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const present = (value: unknown): string => {
  const result = text(value);
  return result && !['none', 'no', 'n/a'].includes(result.toLowerCase()) ? result : '';
};
const first = (details: Data, keys: string[]): string => keys.map(key => present(details[key])).find(Boolean) || '';
const withoutPrice = (value: string): string => value
  .replace(/\s*@\s*\$?\s*[\d,]+(?:\.\d{2})?/g, '')
  .replace(/\s*\(\$\s*[\d,]+(?:\.\d{2})?[^)]*\)/g, '')
  .replace(/[·|-]?\s*\$\s*[\d,]+(?:\.\d{2})?/g, '')
  .replace(/\s{2,}/g, ' ').replace(/[·\-\s]+$/, '').trim();
const itemTitle = (value: string): string => {
  const title = withoutPrice(value);
  const parts = title.split(/\s*-\s*/);
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) return parts[0];
  return title.replace(/\s*-\s*Hair System$/i, '').trim();
};

const SPEC_FIELDS = [
  { label: 'Hair color', keys: ['Choose Color', 'Hair Color'] },
  { label: 'Base (lace or skin)', keys: ['Lace or Skin'] },
  { label: 'Hair length', keys: ['Hair Length'] },
  { label: 'Density', keys: ['Choose Density', 'Choose Density if Needed (75%-110%) - 100% is regular'] },
  { label: 'Curl pattern', keys: ['Curl Pattern', 'Curl Pattern — only if needed'] },
  { label: 'Salon service requested', keys: ['Hair Salon Service Requested'] },
] as const;

export type ManufacturerOrderView = {
  isKit: boolean;
  name: string;
  phone: string;
  email: string;
  items: string[];
  shippingMethod: string;
  shippingAddress: string[];
  specs: { label: string; value: string }[];
  notes: string;
  instruction: string;
  sequence: string;
};

export function manufacturerOrderView(input: { orderDetails: unknown; customerName: unknown; customerEmail: unknown }): ManufacturerOrderView {
  const details = obj(input.orderDetails);
  const order = obj(details.order);
  const isKit = details.kit_order === true || details.supplier_kit === true;
  const shipping = isKit && Object.keys(obj(details.shipping_address)).length
    ? obj(details.shipping_address)
    : obj(details.shipping);
  const sourceItems = Array.isArray(order.line_items) ? order.line_items : Array.isArray(details.line_items) ? details.line_items : [];
  let shippingFromItem = '';
  const items = sourceItems.map(item => {
    const title = itemTitle(text(obj(item).title));
    if (/rush\s*ship|over\s*night|^shipping$/i.test(title)) {
      shippingFromItem = title;
      return '';
    }
    return title;
  }).filter(Boolean);
  if (!isKit && !items.length && details.order_type === 'hair_system') items.push('Hair system');

  const address = [
    text(shipping.address_1) || text(shipping.address1),
    text(shipping.address_2) || text(shipping.address2),
    [text(shipping.city), text(shipping.state)].filter(Boolean).join(', '),
    [text(shipping.zip) || text(shipping.postal_code), text(shipping.country)].filter(Boolean).join(' '),
  ].filter(Boolean);
  const curl = first(details, ['Curl Pattern', 'Curl Pattern — only if needed']);
  const specs = isKit ? [] : SPEC_FIELDS.filter(field => field.label !== 'Salon service requested' || first(details, [...field.keys])).map(field => ({
    label: field.label,
    value: field.label === 'Curl pattern' && curl === 'Standard' ? 'Standard · 3.0 CM'
      : field.label === 'Curl pattern' && curl === 'Extra straight' ? 'Extra straight · 4.0 CM'
      : field.label === 'Hair length' && first(details, ['Hair Length']) === 'Standard' ? 'Standard · 5"'
      : first(details, [...field.keys]) || 'Not provided',
  }));
  const orderNumber = Number(details.order_number);
  const totalOrders = Number(details.total_orders);
  const sequence = Number.isInteger(orderNumber) && Number.isInteger(totalOrders) && orderNumber > 0 && totalOrders >= orderNumber
    ? `System ${orderNumber} of ${totalOrders}` : '';
  return {
    isKit,
    name: first(details, ['full_name', 'name']) || text(shipping.name) || text(input.customerName),
    phone: first(details, ['phone']) || text(obj(order.customer).phone),
    email: text(input.customerEmail),
    items,
    shippingMethod: withoutPrice(text(shipping.method)) || shippingFromItem,
    shippingAddress: address,
    specs,
    notes: present(details.notes),
    instruction: isKit ? '' : 'Please always choose NCON and HS1.',
    sequence,
  };
}
