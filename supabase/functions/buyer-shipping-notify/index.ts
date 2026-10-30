// Scheduled (~1 min) dispatcher for buyer shipping notifications queued by
// future /newtimes tracking saves. Only processes rows already due; callers
// cannot choose orders, recipients, or content.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { relayCall } from '../_shared/barberLaunchGhlRelay.ts';
import { emailDefinitelyNotSent, processQueueRow, RETRY_DELAY_MINUTES, smsDefinitelyNotSent, type Deps, type QueueRow } from '../_shared/buyerShippingNotifications.ts';

const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) throw new Error('Backend configuration unavailable');
const db = createClient(url, key, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const now = () => new Date().toISOString();

const deps: Deps = {
  async readOrder(id) {
    const { data, error } = await db.from('orders').select('id, status, customer_email, customer_name, user_id, external_order_id, tracking_number, tracking_url, order_details').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async profilePhone(userId, email) {
    const { data } = await db.from('profiles').select('phone, email').eq('id', userId).maybeSingle();
    // Only when the linked profile is clearly the same buyer.
    return data && String(data.email ?? '').trim().toLowerCase() === email ? data.phone : null;
  },
  async notified(orderId, channel, excludeId) {
    const { data, error } = await db.from('buyer_shipping_notification_channels').select('status, tracking_keys')
      .eq('order_id', orderId).eq('channel', channel).neq('notification_id', excludeId).in('status', ['sent', 'sending', 'uncertain']);
    if (error) throw error;
    return { keys: new Set((data ?? []).flatMap(r => r.tracking_keys ?? [])), anySent: (data ?? []).some(r => r.status === 'sent') };
  },
  async claimChannel(row, channel, keys) {
    const { data: existing, error } = await db.from('buyer_shipping_notification_channels').select('status').eq('notification_id', row.id).eq('channel', channel).maybeSingle();
    if (error) throw error;
    if (existing) {
      if (existing.status !== 'retry') return false;
      const { data } = await db.from('buyer_shipping_notification_channels').update({ status: 'sending', tracking_keys: keys, updated_at: now() })
        .eq('notification_id', row.id).eq('channel', channel).eq('status', 'retry').select('id');
      if (data?.length) await db.rpc('noop').then(() => {}, () => {});
      return !!data?.length;
    }
    const { error: insErr } = await db.from('buyer_shipping_notification_channels').insert({ notification_id: row.id, order_id: row.order_id, channel, status: 'sending', tracking_keys: keys });
    return !insErr; // unique violation => another worker owns it
  },
  async finishChannel(row, channel, p) {
    const { error } = await db.from('buyer_shipping_notification_channels').update({ status: p.status, reason: p.reason ?? null, recipient_hint: p.recipient ?? null, provider_message_id: p.messageId ?? null, ...(p.keys ? { tracking_keys: p.keys } : {}), updated_at: now() })
      .eq('notification_id', row.id).eq('channel', channel).eq('status', 'sending');
    if (error) console.error('channel finish failed', channel, error.message);
  },
  async recordSkip(row, channel, reason) {
    await db.from('buyer_shipping_notification_channels').insert({ notification_id: row.id, order_id: row.order_id, channel, status: 'skipped', reason });
  },
  async finishRow(row, status, reason) {
    const patch: Record<string, unknown> = { status, reason: reason ?? null, updated_at: now() };
    if (status === 'retry') patch.due_at = new Date(Date.now() + RETRY_DELAY_MINUTES * 60_000).toISOString();
    await db.from('buyer_shipping_notifications').update(patch).eq('id', row.id).eq('status', 'claimed');
  },
  async optedOut(phone) {
    const { data, error } = await db.from('sms_opt_outs').select('phone').eq('phone', phone).maybeSingle();
    if (error) throw error;
    return !!data;
  },
  async sendEmail(i) {
    const r = await relayCall('send_email', { role: 'buyer', to: i.to, name: i.name, subject: i.subject, html: i.html });
    return r.ok ? { ok: true, messageId: r.messageId ?? null } : { ok: false, reason: r.reason, definitelyNotSent: emailDefinitelyNotSent(r.reason) };
  },
  async sendSms(i) {
    const r = await relayCall('send_sms', i);
    return r.ok ? { ok: true, messageId: r.messageId ?? null } : { ok: false, reason: r.reason, definitelyNotSent: smsDefinitelyNotSent(r.reason) };
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { data, error } = await db.rpc('claim_buyer_shipping_notifications', { _limit: 20 });
    if (error) throw error;
    const results = [];
    for (const row of (data ?? []) as QueueRow[]) {
      try { results.push({ id: row.id, ...(await processQueueRow(deps, row)) }); }
      catch (e) { console.error('buyer shipping row failed', row.id, e instanceof Error ? e.message : e); results.push({ id: row.id, row: 'error' }); }
    }
    return json({ processed: results.length, results });
  } catch (e) {
    console.error('buyer-shipping-notify error', e instanceof Error ? e.message : e);
    return json({ error: 'dispatch_failed' }, 500);
  }
});
