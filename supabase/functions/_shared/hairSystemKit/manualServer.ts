import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ghlOrderContact, relayCall } from '../barberLaunchGhlRelay.ts';
import { hairSystemStripeKey } from '../hairSystemFulfillment.ts';
import { KIT_LOCATION } from './logic.ts';
import { readStripeEvidenceByPaymentIntent } from './readStripeEvidence.ts';
import { kitStorage } from './storage.ts';
import { manualKitRecovery, type VerifiedGhlOrder } from './manualRecovery.ts';
import { manualOrderInScope, type ManualRequest } from './manual.ts';

async function readGhlOrder(orderId: string): Promise<VerifiedGhlOrder> {
  const key = (Deno.env.get('GHL_API_KEY') ?? '').trim();
  if (!key) throw new Error('ghl_key_unavailable');
  const url = `https://services.leadconnectorhq.com/payments/orders/${encodeURIComponent(orderId)}?locationId=${KIT_LOCATION}&altType=location`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Version: '2021-04-15', Accept: 'application/json' } });
  if (!response.ok) throw new Error('ghl_order_read_failed');
  const raw = await response.json();
  const order = raw?.order ?? raw?.data ?? raw;
  if (!Array.isArray(order?.items) || typeof order?.updatedAt !== 'string') throw new Error('ghl_order_invalid');
  return { id: String(order._id ?? ''), locationId: String(order.altId ?? ''), contactId: String(order.contactId ?? ''),
    productIds: order.items.map((i: { product?: { _id?: string } }) => String(i.product?._id ?? '')),
    paymentStatus: String(order.paymentStatus ?? ''), status: String(order.status ?? ''), updatedAt: order.updatedAt };
}

export async function runManualKit(db: SupabaseClient, action: 'preview' | 'confirm', input: ManualRequest,
  opts: { adminId: string; secret: string; previewToken?: string; previewExpires?: number; confirmText?: string }) {
  if (!manualOrderInScope(input.order_id, Deno.env.get('MANUAL_KIT_ALLOWED_ORDER_IDS') ?? ''))
    return { status: 'blocked', reason: 'order_outside_manual_authorization' };
  const { data: hold, error: holdError } = await db.from('app_settings').select('value')
    .eq('key', 'hair_system_fulfillment_hold').maybeSingle();
  if (holdError || typeof hold?.value !== 'boolean' || hold.value === true) return { status: 'blocked', reason: 'fulfillment_hold_or_unknown' };
  const { data: prior, error: priorError } = await db.from('hair_system_kit_manual_recoveries')
    .select('status,supplier_message_id').eq('location_id', KIT_LOCATION).eq('ghl_order_id', input.order_id);
  if (priorError) throw new Error('manual_claim_state_unavailable');
  if (prior?.length) return { status: 'blocked', reason: 'existing_manual_claim_requires_reconciliation' };
  const stripeKey = hairSystemStripeKey();
  if (!stripeKey) return { status: 'blocked', reason: 'stripe_key_unavailable' };
  const storage = kitStorage(db);
  return manualKitRecovery(action, input, opts, {
    readFresh: async request => {
      const order = await readGhlOrder(request.order_id);
      const evidence = await readStripeEvidenceByPaymentIntent(request.payment_id, request.order_id, '', stripeKey);
      const contact = await ghlOrderContact(evidence.payment.contactId);
      evidence.contact = contact;
      return { evidence, order };
    },
    checkExisting: async (orderId, paymentId) => {
      const [byOrder, byPayment, delivery] = await Promise.all([
        db.from('orders').select('id,status,order_details').eq('external_order_id', orderId),
        db.from('orders').select('id,status,order_details').eq('payment_reference', `stripe:${paymentId}`),
        db.from('hair_system_kit_deliveries').select('id,status,message_id').eq('location_id', KIT_LOCATION).eq('ghl_order_id', orderId),
      ]);
      if (byOrder.error || byPayment.error || delivery.error) throw new Error('existing_order_state_unavailable');
      const rows = [...(byOrder.data ?? []), ...(byPayment.data ?? [])];
      if (rows.length) {
        const ids = [...new Set(rows.map(r => r.id))];
        const notes = await db.from('order_notifications').select('order_id,channel,status,provider_message_id').in('order_id', ids);
        if (notes.error) throw new Error('supplier_dispatch_state_unavailable');
        throw new Error('existing_order_requires_reconciliation');
      }
      if (delivery.data?.length) throw new Error('existing_supplier_delivery');
    },
    claim: async (facts, adminId) => {
      const { error } = await db.from('hair_system_kit_manual_recoveries').insert({ location_id: KIT_LOCATION,
        ghl_order_id: facts.order_id, payment_id: facts.payment_id, admin_id: adminId,
        release_basis: facts.release_basis, reason: facts.reason, address_evidence: facts.address_evidence,
        preview_facts: facts });
      if (error) throw new Error('manual_claim_failed_or_already_exists');
    },
    ensureRow: storage.ensureRow,
    confirmVisible: storage.confirmVisible,
    reserve: storage.reserve,
    send: async mail => {
      const result = await relayCall('send_email', { role: mail.role, to: mail.to, name: 'New Times Hair',
        subject: mail.subject, html: mail.html });
      return result.ok ? { ok: true, messageId: result.messageId } : { ok: false };
    },
    finishDelivery: storage.finish,
    finishClaim: async (orderId, status, messageId, rowId) => {
      const { data, error } = await db.from('hair_system_kit_manual_recoveries').update({ status,
        supplier_order_id: rowId, supplier_message_id: messageId, completed_at: new Date().toISOString() })
        .eq('location_id', KIT_LOCATION).eq('ghl_order_id', orderId).eq('status', 'reserved').select('id');
      if (error || data?.length !== 1) throw new Error('manual_audit_update_failed');
    },
    verifyResult: async (orderId, rowId, status, messageId) => {
      const [row, delivery, claim] = await Promise.all([
        db.from('orders').select('id,external_order_id,status,order_details').eq('id', rowId).maybeSingle(),
        db.from('hair_system_kit_deliveries').select('status,message_id,order_id').eq('location_id', KIT_LOCATION).eq('ghl_order_id', orderId).maybeSingle(),
        db.from('hair_system_kit_manual_recoveries').select('status,supplier_message_id,supplier_order_id')
          .eq('location_id', KIT_LOCATION).eq('ghl_order_id', orderId).maybeSingle(),
      ]);
      return !row.error && !delivery.error && !claim.error && row.data?.id === rowId &&
        row.data?.external_order_id === orderId && row.data?.status !== 'pending_payment' &&
        row.data?.order_details?.supplier_kit === true && delivery.data?.status === status &&
        delivery.data?.order_id === rowId && delivery.data?.message_id === messageId &&
        claim.data?.status === status && claim.data?.supplier_order_id === rowId &&
        claim.data?.supplier_message_id === messageId;
    },
  });
}
