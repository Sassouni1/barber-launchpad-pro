// Public supplier access layer for /newtimes. No login by owner request; returns only
// the fields the supplier page displays and allows only supplier status/tracking actions
// with the same optimistic checks the page used. Never deletes or touches other tables.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const FIELDS = 'id, status, order_date, customer_name, customer_email, external_order_id, tracking_number, tracking_url, order_details, updated_at';
const TRACKING_ADDED_AT_KEY = 'supplier_tracking_added_at';
const TRACKING_CARRIER_KEY = 'supplier_tracking_carrier';
const REOPEN_HISTORY_KEY = 'supplier_reopen_history';
const CARRIERS = ['DHL', 'FedEx', 'Other'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const asObject = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {});

async function readOrder(id: string) {
  const { data, error } = await db.from('orders').select('status, tracking_number, order_details, updated_at').eq('id', id).neq('status', 'pending_payment').maybeSingle();
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
      return json({ orders: data ?? [] });
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

    if (action === 'update_tracking') {
      const number = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim() : '';
      const carrier = typeof body.carrier === 'string' ? body.carrier : '';
      if (!number || number.length > 100) return fail('Enter a tracking number.');
      if (!CARRIERS.includes(carrier)) return fail('Choose DHL, FedEx, or Other.');
      const order = await readOrder(orderId);
      if (!order) return fail('Order not found.', 404);
      const details = asObject(order.order_details);
      details[TRACKING_ADDED_AT_KEY] = order.tracking_number ? details[TRACKING_ADDED_AT_KEY] || order.updated_at : new Date().toISOString();
      details[TRACKING_CARRIER_KEY] = carrier;
      const trackingUrl = carrier === 'FedEx' ? `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number)}`
        : carrier === 'DHL' ? `https://www.dhl.com/us-en/home/tracking.html?submit=1&tracking-id=${encodeURIComponent(number)}` : null;
      const { data, error } = await db.from('orders').update({ tracking_number: number, tracking_url: trackingUrl, status: 'shipped', order_details: details })
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
      const details = asObject(order.order_details);
      const history = Array.isArray(details[REOPEN_HISTORY_KEY]) ? details[REOPEN_HISTORY_KEY] as unknown[] : [];
      details[REOPEN_HISTORY_KEY] = [...history, { tracking_number: order.tracking_number, carrier: details[TRACKING_CARRIER_KEY] || null, reopened_at: new Date().toISOString(), note }];
      delete details[TRACKING_ADDED_AT_KEY];
      delete details[TRACKING_CARRIER_KEY];
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
