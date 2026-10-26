import { describe, it, expect } from 'bun:test';
import { kitShippingLines, supplierOrderSelected } from '../src/lib/supplierKitOrder';
describe('supplier kit page contract', () => {
  it('selects only the raw GHL order reference', () => {
    expect(supplierOrderSelected({external_order_id:'GHL/raw'},'GHL/raw')).toBe(true);
    expect(supplierOrderSelected({external_order_id:'other'},'GHL/raw')).toBe(false);
  });
  it('displays confirmed kit shipping including optional second line', () => {
    expect(kitShippingLines({supplier_kit:true,shipping_address:{name:'Fixture',address1:'1 Test St',address2:'Unit 2',city:'Clearwater',state:'FL',postal_code:'33764',country:'US'}})).toEqual(['Fixture','1 Test St','Unit 2','Clearwater','FL','33764','US']);
    expect(kitShippingLines({supplier_kit:false,shipping_address:{name:'Fixture'}})).toEqual([]);
  });
});