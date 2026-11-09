import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { relayCall } from '../barberLaunchGhlRelay.ts';
import { KIT_LOCATION } from './logic.ts';
import { canonicalJson, type ManualKitInput } from './manual.ts';
import { manualKitRecovery } from './manualRecovery.ts';

export async function runManualKit(db: SupabaseClient, action: 'preview' | 'confirm', input: ManualKitInput,
  opts: { adminId: string; secret: string; previewToken?: string; previewExpires?: number }) {
  return manualKitRecovery(action, input, opts, {
    checkClaim: async identityKey => {
      const { data, error } = await db.from('hair_system_kit_manual_recoveries').select('status,supplier_message_id')
        .eq('identity_key', identityKey).maybeSingle();
      if (error) throw new Error('manual_claim_state_unavailable');
      return Boolean(data);
    },
    checkExisting: async (request, identityKey) => {
      const [duplicate, deliveries] = await Promise.all([
        db.rpc('manual_kit_duplicate_state', { _email: request.email, _phone: request.phone,
          _name: request.name, _address1: request.shipping.address1,
          _postal_code: request.shipping.postal_code, _request_key: request.request_key }),
        db.from('hair_system_kit_deliveries').select('id,status,message_id')
          .eq('location_id', KIT_LOCATION).eq('entitlement_key', identityKey),
      ]);
      if (duplicate.error || !duplicate.data || !Number.isSafeInteger(duplicate.data.matching_orders) ||
          !Number.isSafeInteger(duplicate.data.supplier_notifications) ||
          !Number.isSafeInteger(duplicate.data.delivery_records) || deliveries.error || !deliveries.data)
        throw new Error('duplicate_state_unavailable');
      if (deliveries.data.length) throw new Error('existing_delivery_requires_reconciliation');
      if (duplicate.data.matching_orders > 0 || duplicate.data.supplier_notifications > 0 || duplicate.data.delivery_records > 0)
        throw new Error('existing_kit_requires_reconciliation');
    },
    claim: async (facts, adminId) => {
      const { error } = await db.from('hair_system_kit_manual_recoveries').insert({
        request_key: facts.request_key, identity_key: facts.identity_key,
        admin_id: adminId, preview_facts: facts,
      });
      if (error?.code === '23505') return false;
      if (error) throw new Error('manual_claim_failed');
      return true;
    },
    createRow: async row => {
      const { data, error } = await db.from('orders').insert(row).select('id').single();
      if (error || !data?.id) throw new Error('manual_order_creation_failed');
      return data.id;
    },
    verifyVisible: async (rowId, expected) => {
      const { data, error } = await db.from('orders').select('id,external_order_id,user_id,status,customer_name,customer_email,order_details')
        .eq('id', rowId).maybeSingle();
      return !error && data?.id === rowId && data?.external_order_id === expected.external_order_id &&
        data?.user_id === null && data?.status !== 'pending_payment' && data?.customer_name === expected.customer_name &&
        data?.customer_email === expected.customer_email && data?.order_details?.manual_source === 'admin_entry' &&
        canonicalJson(data?.order_details?.manual_facts) === canonicalJson(expected.order_details.manual_facts) &&
        canonicalJson(data?.order_details?.order) === canonicalJson(expected.order_details.order);
    },
    reserveDelivery: async (identityKey, rowId) => {
      const { error } = await db.from('hair_system_kit_deliveries').insert({
        location_id: KIT_LOCATION, entitlement_key: identityKey, order_id: rowId,
      });
      if (error?.code === '23505') return false;
      if (error) throw new Error('delivery_reservation_failed');
      return true;
    },
    send: async mail => {
      const result = await relayCall('send_email', { role: mail.role, to: mail.to, name: 'New Times Hair',
        subject: mail.subject, html: mail.html });
      return result.ok ? { ok: true, messageId: result.messageId } : { ok: false };
    },
    finishDelivery: async (identityKey, status, messageId) => {
      const { data, error } = await db.from('hair_system_kit_deliveries').update({
        status, message_id: messageId, reason: status === 'uncertain' ? 'Manual reconciliation required; never resend automatically.' : null,
        completed_at: new Date().toISOString(),
      }).eq('location_id', KIT_LOCATION).eq('entitlement_key', identityKey).eq('status', 'reserved').select('id');
      if (error || data?.length !== 1) throw new Error('delivery_audit_unconfirmed');
    },
    finishClaim: async (identityKey, status, messageId, rowId) => {
      const { data, error } = await db.from('hair_system_kit_manual_recoveries').update({
        status, supplier_message_id: messageId, supplier_order_id: rowId, completed_at: new Date().toISOString(),
      }).eq('identity_key', identityKey).eq('status', 'reserved').select('id');
      if (error || data?.length !== 1) throw new Error('manual_audit_unconfirmed');
    },
    verifyResult: async (identityKey, rowId, status, messageId) => {
      const [row, delivery, claim] = await Promise.all([
        db.from('orders').select('id,status,order_details').eq('id', rowId).maybeSingle(),
        db.from('hair_system_kit_deliveries').select('status,message_id,order_id')
          .eq('location_id', KIT_LOCATION).eq('entitlement_key', identityKey).maybeSingle(),
        db.from('hair_system_kit_manual_recoveries').select('status,supplier_message_id,supplier_order_id')
          .eq('identity_key', identityKey).maybeSingle(),
      ]);
      return !row.error && !delivery.error && !claim.error && row.data?.id === rowId &&
        row.data?.status !== 'pending_payment' && row.data?.order_details?.manual_source === 'admin_entry' &&
        delivery.data?.status === status && delivery.data?.message_id === messageId &&
        delivery.data?.order_id === rowId && claim.data?.status === status &&
        claim.data?.supplier_message_id === messageId && claim.data?.supplier_order_id === rowId;
    },
  });
}
