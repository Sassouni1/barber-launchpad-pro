import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { kitOrderRow, KIT_LOCATION, type KitEvidence } from './logic.ts';

// Storage primitives are intentionally not wired to an executable endpoint.
// Qualification and a verified supplier-page contract must precede their use.
export function kitStorage(db: SupabaseClient) {
  return {
    async ensureRow(row: ReturnType<typeof kitOrderRow>): Promise<string> {
      // Ignore-on-conflict preserves legacy records instead of overwriting them.
      const { error } = await db.from('orders').upsert(row, { onConflict: 'external_order_id', ignoreDuplicates: true });
      if (error) throw new Error('kit_order_creation_failed');
      const { data, error: readError } = await db.from('orders').select('id,user_id,status,order_details')
        .eq('external_order_id', row.external_order_id).single();
      if (readError || !data || data.user_id !== null || data.status === 'pending_payment' || data.order_details?.supplier_kit !== true) {
        throw new Error('existing_order_contract_conflict');
      }
      return data.id;
    },
    async confirmVisible(id: string, e: KitEvidence): Promise<boolean> {
      const { data, error } = await db.from('orders').select('external_order_id,user_id,status,order_details').eq('id',id).single();
      if (error || !data || data.external_order_id !== e.order.id || data.user_id !== null || data.status === 'pending_payment') return false;
      const expected = kitOrderRow(e).order_details;
      const d = data.order_details;
      return d?.supplier_kit === true && d.ghl_location_id === KIT_LOCATION && d.phone === e.contact.phone
        && Object.entries(expected.shipping_address).every(([key,value]) => d.shipping_address?.[key] === value)
        && Array.isArray(d.order?.line_items) && d.order.line_items.length === expected.order.line_items.length
        && expected.order.line_items.every((item,index) => d.order.line_items[index]?.title === item.title && d.order.line_items[index]?.quantity === 1);
    },
    async reserve(locationId: string, orderId: string, rowId: string): Promise<boolean> {
      if (locationId !== KIT_LOCATION) throw new Error('location_mismatch');
      const { error } = await db.from('hair_system_kit_deliveries').insert({ location_id:locationId,ghl_order_id:orderId,order_id:rowId });
      if (error?.code === '23505') return false;
      if (error) throw new Error('delivery_reservation_failed');
      return true;
    },
    async finish(orderId: string, status: 'sent' | 'uncertain', messageId: string | null) {
      const { data, error } = await db.from('hair_system_kit_deliveries').update({ status,message_id:messageId,
        reason:status === 'uncertain' ? 'Delivery outcome uncertain; manual reconciliation required. No automatic retry.' : null,
        completed_at:new Date().toISOString() }).eq('location_id',KIT_LOCATION).eq('ghl_order_id',orderId).eq('status','reserved').select('id');
      if (error || data?.length !== 1) throw new Error('reservation_audit_unconfirmed');
    },
  };
}