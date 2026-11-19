// Copied unchanged from Vlix Booking (vlix-cert-release) so Barber Launch reads booking-page prices the same way Vlix onboarding does. Only import paths differ.
import type { ServiceVersion } from './model.ts';
export type ServicePrice = { price: string; priceKind?: 'fixed' | 'starting' | 'range' | 'variable' | 'unknown'; priceMax?: string; priceLabel?: string };
const money = (value: string) => Number(value.replace(/,/g, '')).toString();
/** Read a price field, not an entire service description (which may contain add-ons). */
export function parseServicePrice(raw: unknown): ServicePrice {
  const text = String(raw ?? '').replace(/\u00a0/g, ' ').replace(/^price\s*:?\s*/i, '').trim();
  if (!text) return { price: '', priceKind: 'unknown' };
  if (/[€£¥]|\b(EUR|GBP|CAD|AUD|NZD|MXN)\b|(?:CA|AU|NZ|C|A)\$/i.test(text)) return { price: '', priceKind: 'unknown', priceLabel: text.slice(0,100) };
  if (/^(free|no charge)$/i.test(text)) return { price: '0', priceKind: 'fixed' };
  const number = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';
  const range = text.match(new RegExp(`^(?:USD\\s*|\\$)?\\s*${number}\\s*(?:-|–|—|to)\\s*(?:USD\\s*|\\$)?\\s*${number}(?:\\s*USD)?$`, 'i'));
  if (range && Number(money(range[2])) >= Number(money(range[1]))) return { price: money(range[1]), priceKind: 'range', priceMax: money(range[2]) };
  const amount = text.match(new RegExp(`^(?:(?:from|starting(?:\\s+at)?|starts?\\s+at)\\s*)?(?:USD\\s*|\\$)?\\s*${number}\\s*(?:\\+|and\\s+up|&\\s*up|upwards)?(?:\\s*USD)?$`, 'i'));
  if (amount) return { price: money(amount[1]), priceKind: /from|start|\+|and\s+up|&\s*up|upwards/i.test(text) ? 'starting' : 'fixed' };
  return { price: '', priceKind: /varies|variable|consultation|quote|upon request|contact/i.test(text) ? 'variable' : 'unknown', priceLabel: text.slice(0,100) };
}
export function servicePriceLabel(value: ServicePrice) {
  if (value.priceKind === 'starting' && value.price) return `From $${value.price}`;
  if (value.priceKind === 'range' && value.price && value.priceMax) return `$${value.price}–$${value.priceMax}`;
  return value.price ? `$${value.price}` : value.priceLabel || 'Price not found';
}
export function importedServicePricing(value: ServicePrice & { duration: string; description?: string; versions?: ServiceVersion[] }) {
  return { price: value.versions?.length ? '' : value.price, duration: value.duration, description: value.description, versions: value.versions, priceEdited: false,
    sourcePrice: value.versions?.length ? '' : servicePriceLabel(value), requiresPriceConfirmation: !value.versions?.length && !!value.price && !!value.priceKind && value.priceKind !== 'fixed' };
}
