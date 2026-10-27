import { describe, it, expect } from 'bun:test';
import { supplierPriceFor, supplierPaymentState } from '../src/lib/supplierPrice';
import { KIT_MANIFEST } from '../src/lib/supplierKitOrder';

const kit = (items: unknown[]) => ({ supplier_kit: true, order: { line_items: items } });

describe('supplier price rules', () => {
  it('single lace is $175', () => expect(supplierPriceFor({ 'Lace or Skin': '  LACE ' }).amount).toBe(175));
  it('single skin is $160', () => expect(supplierPriceFor({ 'Lace or Skin': 'skin' }).amount).toBe(160));
  it('kit is fixed $345, not 175+160', () => {
    const p = supplierPriceFor(kit(KIT_MANIFEST.map(i => ({ ...i }))));
    expect(p.amount).toBe(345);
    expect(p.amount).not.toBe(335);
  });
  it('every marked kit is $345 regardless of line item details', () => {
    expect(supplierPriceFor(kit([{ title: '1 #2 skin system', quantity: 1 }])).amount).toBe(345);
    expect(supplierPriceFor({ kit_order: true }).amount).toBe(345);
  });
  it('known manifest without kit flag is not priced as kit', () => {
    expect(supplierPriceFor({ order: { line_items: KIT_MANIFEST.map(i => ({ ...i })) } }).kind).toBe('review');
  });
  it('missing or ambiguous base needs review', () => {
    expect(supplierPriceFor({}).kind).toBe('review');
    expect(supplierPriceFor({ 'Lace or Skin': 'Lace front skin' }).kind).toBe('review');
    expect(supplierPriceFor({ 'Lace or Skin': 'Not sure' }).kind).toBe('review');
  });
  it('ignores customer totals, add-ons and shipping', () => {
    expect(supplierPriceFor({ 'Lace or Skin': 'Lace', total: 315, shipping: { price: 50 } }).amount).toBe(175);
  });
});

describe('supplier payment state', () => {
  it('unpaid by default', () => expect(supplierPaymentState(null, null)).toEqual({ paid: false, readyForShipment: false }));
  it('paid untracked is ready for shipment', () => expect(supplierPaymentState('2026-10-26', null)).toEqual({ paid: true, readyForShipment: true }));
  it('paid tracked is not ready for shipment', () => expect(supplierPaymentState('2026-10-26', '1Z')).toEqual({ paid: true, readyForShipment: false }));
});
