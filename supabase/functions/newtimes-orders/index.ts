// Public supplier access layer for /newtimes. No login by owner request; returns only
// the fields the supplier page displays and allows only supplier status/tracking actions
// with the same optimistic checks the page used. Never deletes or touches other tables.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { changeExtraPackage, ensurePrimaryUnique, reopenTrackingDetails, type ExtraChange } from '../_shared/supplierTracking.ts';

import { completionUpdate, preserveCompletionClock, trackingSaveStatus } from '../_shared/supplierOrderLifecycle.ts';
import { shippingLocationUpdate, shippingLocations, type ShippingLocations } from '../_shared/supplierShippingLocations.ts';
import { publicOrderDetails } from './projection.ts';

const FIELDS = 'id, status, order_date, customer_name, customer_email, external_order_id, tracking_number, tracking_url, order_details, updated_at';
const TRACKING_ADDED_AT_KEY = 'supplier_tracking_added_at';
const TRACKING_CARRIER_KEY = 'supplier_tracking_carrier';
const REOPEN_HISTORY_KEY = 'supplier_reopen_history';
const CARRIERS = ['DHL', 'FedEx', 'Other'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const backendUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!backendUrl || !serviceKey) throw new Error('Backend configuration unavailable');
const db = createClient(backendUrl, serviceKey, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const asObject = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {});


async function readOrder(id: string) {
  const { data, error } = await db.from('orders').select('status, tracking_number, tracking_url, order_details, updated_at, tracking_seen').eq('id', id).neq('status', 'pending_payment').maybeSingle();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Method not allowed', 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail('Invalid JSON'); }
  const action = body.action;
  try {
    if (action === 'list') {
      const { data, error } = await db.from('orders').select(FIELDS).neq('status', 'pending_payment').order('order_date', { ascending: false });
      if (error) throw error;
      const { data: marks, error: markError } = await db.from('supplier_payment_markers').select('order_id, paid_at');
      if (markError) throw markError;
      const paid = new Map((marks ?? []).map((m) => [m.order_id, m.paid_at]));
      return json({ orders: (data ?? []).map((o) => ({ ...o, order_details: publicOrderDetails(o.order_details), supplier_paid_at: paid.get(o.id) ?? null })) });
    }

    const orderId = typeof body.orderId === 'string' && UUID.test(body.orderId) ? body.orderId : null;
    if (!orderId) return fail('A valid order ID is required.');

    if (action === 'mark_placed' || action === 'undo_placed') {
      const [from, to] = action === 'mark_placed' ? ['pending', 'processing'] : ['processing', 'pending'];
      const { data, error } = await db.from('orders').update({ status: to }).eq('id', orderId).eq('status', from).is('tracking_number', null).select('id');
      if (error) throw error;
      if (!data?.length) return fail(action === 'mark_placed' ? 'Order is no longer new. Refresh and try again.' : 'Order can no longer be unplaced. Refresh and check its tracking.', 409);
      return json({ ok: true });
    }

    if (action === 'complete_order' || action === 'undo_completion') {
      if (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) return fail('Refresh the order before changing completion.');
      const order = await readOrder(orderId);
      if (!order) return fail('Order not found.', 404);
      if (order.updated_at !== body.expectedUpdatedAt) return fail('Order changed. Refresh and try again.', 409);
      let patch;
      try { patch = completionUpdate(order, action === 'complete_order', new Date().toISOString()); }
      catch (e) { return fail(e instanceof Error ? e.message : 'Invalid completion state.'); }
      const { data, error } = await db.from('orders').update(patch).eq('id', orderId).neq('status', 'pending_payment')
        .eq('updated_at', body.expectedUpdatedAt).eq('status', order.status).eq('tracking_number', order.tracking_number).select('id');
      if (error) throw error;
      if (!data?.length) return fail('Order changed while completing. Refresh and try again.', 409);
      return json({ ok: true });
    }

    if (action === 'set_shipping_locations') {
      if (body.mode !== 'one' && body.mode !== 'two') return fail('Choose one or two shipping locations.');
      if (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) return fail('Refresh the order before changing shipping locations.');
      const order = await readOrder(orderId);
      if (!order) return fail('Order not found.', 404);
      if (order.updated_at !== body.expectedUpdatedAt) return fail('Order changed. Refresh and try again.', 409);
      if (!order.tracking_number) return fail('Add the first tracking number before changing shipping locations.');
      const details = preserveCompletionClock(order);
      const carrier = details[TRACKING_CARRIER_KEY] as 'DHL' | 'FedEx' | 'Other' | null;
      const patch = shippingLocationUpdate(details, order.tracking_number, carrier, body.mode as ShippingLocations, new Date().toISOString());
      const { data, error } = await db.from('orders').update(patch).eq('id', orderId).eq('updated_at', body.expectedUpdatedAt).eq('tracking_number', order.tracking_number).select('id');
      if (error) throw error;
      if (!data?.length) return fail('Order changed while saving. Refresh and try again.', 409);
      return json({ ok: true });
    }

    if (action === 'add_additional_tracking' || action === 'edit_additional_tracking' || action === 'remove_additional_tracking') {
      if (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) return fail('Refresh the order before changing packages.');
      const order = await readOrder(orderId);
      if (!order) return fail('Order not found.', 404);
      if (order.updated_at !== body.expectedUpdatedAt) return fail('Order changed. Refresh and try again.', 409);
      let details: Record<string, unknown>;
      try { details = changeExtraPackage(preserveCompletionClock(order), order.tracking_number, { ...body, action } as ExtraChange, new Date().toISOString(), order.updated_at); }
      catch (e) { return fail(e instanceof Error ? e.message : 'Invalid package tracking.'); }
      const mode = shippingLocations(details);
      const patch = mode ? shippingLocationUpdate(details, order.tracking_number, details[TRACKING_CARRIER_KEY] as 'DHL' | 'FedEx' | 'Other' | null, mode, new Date().toISOString()) : { order_details: details };
      const { data, error } = await db.from('orders').update(patch)
        .eq('id', orderId).neq('status', 'pending_payment').eq('updated_at', body.expectedUpdatedAt).eq('tracking_number', order.tracking_number).select('id');
      if (error) throw error;
      if (!data?.length) return fail('Order changed while saving packages. Refresh and try again.', 409);
      return json({ ok: true });
    }

    if (action === 'update_tracking') {
      const number = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim() : '';
      const carrier = typeof body.carrier === 'string' ? body.carrier : '';
      if (!number || number.length > 100) return fail('Enter a tracking number.');
      if (!CARRIERS.includes(carrier)) return fail('Choose DHL, FedEx, or Other.');
      const order = await readOrder(orderId);
      if (!order) return fail('Order not found.', 404);
      try { ensurePrimaryUnique(order.order_details, number); } catch (e) { return fail(e instanceof Error ? e.message : 'Duplicate tracking.'); }
      const details = preserveCompletionClock(order);
      details[TRACKING_ADDED_AT_KEY] = order.tracking_number ? details[TRACKING_ADDED_AT_KEY] || order.updated_at : new Date().toISOString();
      details[TRACKING_CARRIER_KEY] = carrier;
      const requestedMode = body.mode;
      if (requestedMode !== undefined && requestedMode !== 'one' && requestedMode !== 'two') return fail('Choose one or two shipping locations.');
      const mode = (requestedMode as ShippingLocations | undefined) ?? shippingLocations(details);
      if (!order.tracking_number && !mode) return fail('Choose one or two shipping locations.');
      const trackingUrl = carrier === 'FedEx' ? `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number)}`
        : carrier === 'DHL' ? `https://www.dhl.com/us-en/home/tracking.html?submit=1&tracking-id=${encodeURIComponent(number)}` : null;
      const flow = mode ? shippingLocationUpdate(details, number, carrier as 'DHL' | 'FedEx' | 'Other', mode, new Date().toISOString())
        : { status: trackingSaveStatus(order.status), order_details: details };
      const { data, error } = await db.from('orders').update({ tracking_number: number, tracking_url: trackingUrl, ...flow })
        .eq('id', orderId).eq('updated_at', order.updated_at).select('id');
      if (error) throw error;
      if (!data?.length) return fail('Order changed while saving. Refresh and try again.', 409);
      return json({ ok: true });
    }

    if (action === 'reopen') {
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
      const order = await readOrder(orderId);
      if (!order) return fail('Order not found.', 404);
      if (!order.tracking_number) return fail('This order no longer has tracking. Refresh and try again.', 409);
      const details = reopenTrackingDetails(order.order_details, order.tracking_number, order.tracking_url, new Date().toISOString(), note);
      const { data, error } = await db.from('orders').update({ status: 'processing', tracking_number: null, tracking_url: null, tracking_seen: false, order_details: details })
        .eq('id', orderId).eq('tracking_number', order.tracking_number).eq('updated_at', order.updated_at).select('id');
      if (error) throw error;
      if (!data?.length) return fail('Order changed while reopening. Refresh and try again.', 409);
      return json({ ok: true });
    }

    return fail('Unsupported action.');
  } catch (e) {
    console.error('newtimes-orders error', e);
    return fail('Something went wrong. Please try again.', 500);
  }
});
