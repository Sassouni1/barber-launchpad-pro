// Chris's supplier costs (what Chris pays New Times), in whole USD.
// The kit is a fixed $345 price — intentionally NOT lace + skin summed.
export const SUPPLIER_PRICES = { lace: 175, skin: 160, kit: 345 } as const;

export type SupplierPrice =
  | { kind: 'lace' | 'skin' | 'kit'; amount: number; label: string }
  | { kind: 'review'; amount: null; label: 'Price needs review' };

type Data = Record<string, unknown>;
const obj = (v: unknown): Data => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Data) : {});
const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const REVIEW: SupplierPrice = { kind: 'review', amount: null, label: 'Price needs review' };

export function supplierPriceFor(orderDetails: unknown): SupplierPrice {
  const details = obj(orderDetails);
  const kitFlag = details.kit_order === true || details.supplier_kit === true;
  if (kitFlag) {
    return { kind: 'kit', amount: SUPPLIER_PRICES.kit, label: '$345' };
  }
  const base = norm(details['Lace or Skin']);
  if (base === 'lace') return { kind: 'lace', amount: SUPPLIER_PRICES.lace, label: '$175' };
  if (base === 'skin') return { kind: 'skin', amount: SUPPLIER_PRICES.skin, label: '$160' };
  return REVIEW;
}

export type SupplierPaymentState = { paid: boolean; readyForShipment: boolean };
export function supplierPaymentState(paidAt: string | null | undefined, trackingNumber: string | null | undefined): SupplierPaymentState {
  const paid = !!paidAt;
  return { paid, readyForShipment: paid && !trackingNumber };
}
