import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { relayCall } from '../barberLaunchGhlRelay.ts';
import { KIT_LOCATION } from './logic.ts';
import { canonicalJson, type IndividualInput } from './manualIndividual.ts';
import { manualIndividualRecovery } from './manualIndividualRecovery.ts';

export async function runManualIndividual(db: SupabaseClient, action: 'preview' | 'confirm', input: IndividualInput,
  opts: { adminId: string; secret: string; previewToken?: string; previewExpires?: number }) {
  const { data: hold, error: holdError } = await db.from('app_settings').select('value')
    .eq('key', 'hair_system_fulfillment_hold').maybeSingle();
  if (holdError || typeof hold?.value !== 'boolean') return { status: 'blocked', reason: 'fulfillment_hold_unknown' };
  if (hold.value === true) return { status: 'blocked', reason: 'fulfillment_held' };
  return manualIndividualRecovery(action, input, opts, {
    checkExisting: async (request, fingerprint) => {
      const { data, error } = await db.rpc('manual_individual_duplicate_state', {
        _fingerprint: fingerprint, _request_key: request.request_key,
        _repeat_of: request.repeat_of_order_id, _name: request.name,
        _address1: request.shipping.address1, _postal_code: request.shipping.postal_code,
        _variant: request.variant,
      });
      const keys = ['prior_orders', 'external_orders', 'matching_claims', 'matching_deliveries', 'matching_notifications'];
      if (error || !data || typeof data.parent_valid !== 'boolean' || keys.some(key => !Number.isSafeInteger(data[key])))
        throw Error('duplicate_state_unavailable');
      if (!data.parent_valid) throw Error('repeat_parent_invalid');
      if (keys.some(key => data[key] > 0)) throw Error('existing_individual_requires_reconciliation');
    },
    claim: async (facts, adminId) => {
      const { error } = await db.from('hair_system_manual_individual_claims').insert({
        request_key: facts.request_key, fingerprint: facts.fingerprint,
        repeat_of_order_id: facts.repeat_of_order_id, admin_id: adminId, preview_facts: facts,
      });
      if (error?.code === '23505') return false;
      if (error) throw Error('individual_claim_failed');
      return true;
    },
    createRow: async row => {
      const { data, error } = await db.from('orders').insert(row).select('id').single();
      if (error || !data?.id) throw Error('individual_order_creation_failed');
      return data.id;
    },
    verifyVisible: async (rowId, expected) => {
      const { data, error } = await db.from('orders').select('id,external_order_id,user_id,status,customer_name,customer_email,order_details')
        .eq('id', rowId).maybeSingle();
      return !error && data?.id === rowId && data.external_order_id === expected.external_order_id &&
        data.user_id === null && data.status === 'pending' && data.customer_name === expected.customer_name &&
        data.customer_email === expected.customer_email && data.order_details?.manual_individual === true &&
        data.order_details?.supplier_kit === false &&
        canonicalJson(data.order_details?.manual_facts) === canonicalJson(expected.order_details.manual_facts) &&
        canonicalJson(data.order_details?.order) === canonicalJson(expected.order_details.order);
    },
    reserveDelivery: async (key, rowId) => {
      const { error } = await db.from('hair_system_kit_deliveries').insert({
        location_id: KIT_LOCATION, entitlement_key: key, order_id: rowId,
      });
      if (error?.code === '23505') return false;
      if (error) throw Error('delivery_reservation_failed');
      return true;
    },
    send: async mail => {
      const result = await relayCall('send_email', { role: mail.role, to: mail.to, name: 'New Times Hair',
        subject: mail.subject, html: mail.html });
      return result.ok ? { ok: true, messageId: result.messageId } : { ok: false };
    },
    finishDelivery: async (key, status, messageId) => {
      const { data, error } = await db.from('hair_system_kit_deliveries').update({
        status, message_id: messageId, reason: status === 'uncertain' ? 'Manual reconciliation required; never resend automatically.' : null,
        completed_at: new Date().toISOString(),
      }).eq('location_id', KIT_LOCATION).eq('entitlement_key', key).eq('status', 'reserved').select('id');
      if (error || data?.length !== 1) throw Error('delivery_audit_unconfirmed');
    },
    finishClaim: async (key, status, messageId, rowId) => {
      const [_, fingerprint, repeat] = key.split(':');
      const query = db.from('hair_system_manual_individual_claims').update({
        status, supplier_message_id: messageId, supplier_order_id: rowId, completed_at: new Date().toISOString(),
      }).eq('fingerprint', fingerprint).eq('status', 'reserved');
      const { data, error } = await (repeat === 'first' ? query.is('repeat_of_order_id', null) : query.eq('repeat_of_order_id', repeat)).select('id');
      if (error || data?.length !== 1) throw Error('individual_audit_unconfirmed');
    },
    verifyResult: async (key, rowId, status, messageId) => {
      const [_, fingerprint, repeat] = key.split(':');
      const [row, delivery, claim] = await Promise.all([
        db.from('orders').select('id,status,order_details').eq('id', rowId).maybeSingle(),
        db.from('hair_system_kit_deliveries').select('status,message_id,order_id')
          .eq('location_id', KIT_LOCATION).eq('entitlement_key', key).maybeSingle(),
        (repeat === 'first'
          ? db.from('hair_system_manual_individual_claims').select('status,supplier_message_id,supplier_order_id').eq('fingerprint', fingerprint).is('repeat_of_order_id', null)
          : db.from('hair_system_manual_individual_claims').select('status,supplier_message_id,supplier_order_id').eq('fingerprint', fingerprint).eq('repeat_of_order_id', repeat)).maybeSingle(),
      ]);
      return !row.error && !delivery.error && !claim.error && row.data?.id === rowId &&
        row.data?.status === 'pending' && row.data?.order_details?.manual_individual === true &&
        delivery.data?.status === status && delivery.data?.message_id === messageId && delivery.data?.order_id === rowId &&
        claim.data?.status === status && claim.data?.supplier_message_id === messageId && claim.data?.supplier_order_id === rowId;
    },
  });
}
