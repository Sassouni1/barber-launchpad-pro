// Buyer shipping notifications for /newtimes tracking saves.
// The database trigger queues ONLY newly added tracking keys from future saves
// (no backfill) with a 10-minute due time; this module reads the order fresh at
// dispatch, sends only keys that are still active, and records one independent
// outcome per channel. Ambiguous provider responses are terminal ("uncertain").
import { normalizePhone } from './ghlMessaging.ts';
import { extraPackages, numberKey, objectDetails, trackingUrl, type TrackingCarrier } from './supplierTracking.ts';

export const QUEUE_DELAY_MINUTES = 10;
export const RETRY_DELAY_MINUTES = 5;
export const MAX_ATTEMPTS = 5;
export const REGULAR_SUBJECT = 'Your hair system has shipped. Tracking info';
export const KIT_SUBJECT = 'Your hair system kit is on its way. Tracking info';
const STOP_FOOTER = 'Reply STOP to opt out.';

export type Channel = 'email' | 'sms';
export type ShipOrder = {
  id: string; status: string; customer_email: string | null; customer_name: string | null; user_id: string | null;
  external_order_id?: string | null; tracking_number: string | null; tracking_url: string | null; order_details: unknown;
};
export type Pkg = { key: string; number: string; carrier: TrackingCarrier | null; url: string | null };
export type QueueRow = { id: string; order_id: string; new_keys: string[]; attempts: number };

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export function safeHttps(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try { const u = new URL(value.trim()); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export const isKitOrder = (details: unknown) => { const d = objectDetails(details); return d.supplier_kit === true || d.kit_order === true; };

/** Active packages on the fresh order: primary first, then additional packages. */
export function activePackages(order: ShipOrder): Pkg[] {
  if (!order.tracking_number) return [];
  const d = objectDetails(order.order_details);
  const c = d.supplier_tracking_carrier;
  const carrier = c === 'DHL' || c === 'FedEx' || c === 'Other' ? c : null;
  const primaryUrl = carrier === 'DHL' || carrier === 'FedEx' ? trackingUrl(order.tracking_number, carrier) : safeHttps(order.tracking_url);
  const out: Pkg[] = [{ key: numberKey(order.tracking_number), number: order.tracking_number.trim(), carrier, url: primaryUrl }];
  for (const e of extraPackages(d)) {
    const key = numberKey(e.tracking_number);
    if (!out.some(p => p.key === key)) out.push({ key, number: e.tracking_number, carrier: e.carrier, url: safeHttps(e.tracking_url) });
  }
  return out;
}

/** Packages to announce: queued as new, still active now, and not already announced on this channel. */
export function packagesToSend(active: Pkg[], newKeys: string[], alreadyNotified: Set<string>): Pkg[] {
  const queued = new Set(newKeys.map(numberKey));
  return active.filter(p => queued.has(p.key) && !alreadyNotified.has(p.key));
}

export function orderReference(order: ShipOrder): string {
  const d = objectDetails(order.order_details);
  const n = d.order_number;
  if (typeof n === 'number' || (typeof n === 'string' && n.trim())) return `#${String(n).trim()}`;
  if (order.external_order_id) return String(order.external_order_id);
  return order.id.slice(0, 8).toUpperCase();
}
const firstName = (order: ShipOrder) => String(objectDetails(order.order_details).full_name ?? order.customer_name ?? '').trim().split(/\s+/)[0] || '';
const pkgText = (p: Pkg) => `${p.number}${p.carrier && p.carrier !== 'Other' ? ` (${p.carrier})` : ''}${p.url ? ` ${p.url}` : ''}`;

export function buildShippingSms(pkgs: Pkg[], kit: boolean, isUpdate: boolean): string {
  const many = pkgs.length > 1;
  const lead = isUpdate
    ? (kit ? 'Barber Launch: Another package from your hair system kit is on its way.' : 'Barber Launch: Another package from your hair system order has shipped.')
    : (kit ? 'Barber Launch: Your hair system kit is on its way.' : 'Barber Launch: Your hair system order has shipped.');
  const label = many ? 'Here are the tracking numbers:' : kit ? 'Here’s the tracking number:' : 'Here’s your tracking number:';
  const body = many ? pkgs.map(pkgText).join('; ') : (() => { const p = pkgs[0]; return `${p.number}${p.carrier && p.carrier !== 'Other' ? ` (${p.carrier})` : ''}.${p.url ? ` ${p.url}` : ''}`; })();
  return `${lead} ${label} ${body} ${STOP_FOOTER}`;
}

export function buildShippingEmail(order: ShipOrder, pkgs: Pkg[], kit: boolean, isUpdate: boolean) {
  const subject = kit ? KIT_SUBJECT : REGULAR_SUBJECT;
  const name = firstName(order);
  const ref = orderReference(order);
  const headline = isUpdate ? 'Another package is on its way' : kit ? 'Your hair system kit is on its way' : 'Your hair system has shipped';
  const intro = isUpdate ? 'Another package from your order has shipped. Tracking details are below.'
    : kit ? 'Good news — your hair system kit is on its way. Tracking details are below.'
    : 'Good news — your hair system order has shipped. Tracking details are below.';
  const rows = pkgs.map((p, i) => `<tr><td style="padding:16px 18px;border-top:${i ? '1px solid #2a2a2a' : '0'}">
      <div style="color:#9a9a9a;font-size:12px;text-transform:uppercase;letter-spacing:1px">${pkgs.length > 1 ? `Package ${i + 1} · ` : ''}${esc(p.carrier && p.carrier !== 'Other' ? p.carrier : 'Carrier')}</div>
      <div style="color:#ffffff;font-size:18px;font-weight:700;margin:6px 0 12px;word-break:break-all">${esc(p.number)}</div>
      ${p.url ? `<a href="${esc(p.url)}" style="display:inline-block;background:#d6ae52;color:#111111;text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:6px">Track package</a>`
        : `<div style="color:#bdbdbd;font-size:13px">Use this tracking number on the carrier's website.</div>`}
    </td></tr>`).join('');
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f4f2;font-family:Helvetica,Arial,sans-serif;color:#171717">
<div style="max-width:640px;margin:0 auto;padding:24px 12px">
  <div style="background:#111;color:#d6ae52;padding:22px 24px;font-size:22px;font-weight:700">Barber Launch</div>
  <div style="background:#fff;padding:28px 24px">
    <div style="color:#b08a2e;font-size:13px;font-weight:700;text-transform:uppercase">${isUpdate ? 'Shipping update' : 'Shipped'}</div>
    <h1 style="font-size:25px;margin:7px 0 12px">${esc(headline)}</h1>
    <p style="margin:0 0 7px">Hi ${esc(name || 'there')},</p>
    <p style="margin:0 0 22px">${esc(intro)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
      <tr><td style="padding:4px 12px 4px 0;color:#666">Order reference</td><td style="padding:4px 0;text-align:right;font-weight:700">${esc(ref)}</td></tr>
    </table>
    <h2 style="font-size:17px;margin:22px 0 10px">Tracking</h2>
    <table role="presentation" style="width:100%;border-collapse:collapse;background:#111;border:1px solid #d6ae52;border-radius:8px">${rows}</table>
    <p style="margin:22px 0 0;color:#666;font-size:13px">Tracking can take up to 24 hours to show movement after a label is created.</p>
    <p style="margin:28px 0 0;border-top:1px solid #e5e5e5;padding-top:20px">Thank you for your order with Barber Launch.</p>
  </div>
</div></body></html>`;
  const text = [`Hi ${name || 'there'},`, intro, `Order reference: ${ref}`, ...pkgs.map(p => `${p.carrier && p.carrier !== 'Other' ? `${p.carrier}: ` : ''}${p.number}${p.url ? ` — ${p.url}` : ''}`), 'Thank you for your order with Barber Launch.'].join('\n');
  return { subject, html, text };
}

export type SendOutcome = { ok: true; messageId: string | null } | { ok: false; reason: string; definitelyNotSent: boolean };
export type Deps = {
  readOrder(id: string): Promise<ShipOrder | null>;
  profilePhone(userId: string, email: string): Promise<string | null>;
  notified(orderId: string, channel: Channel, excludeId: string): Promise<{ keys: Set<string>; anySent: boolean }>;
  claimChannel(row: QueueRow, channel: Channel, keys: string[]): Promise<boolean>;
  finishChannel(row: QueueRow, channel: Channel, patch: { status: 'sent' | 'skipped' | 'retry' | 'failed' | 'uncertain'; reason?: string | null; recipient?: string | null; messageId?: string | null; keys?: string[] }): Promise<void>;
  recordSkip(row: QueueRow, channel: Channel, reason: string): Promise<void>;
  finishRow(row: QueueRow, status: 'done' | 'suppressed' | 'retry', reason?: string | null): Promise<void>;
  optedOut(phone: string): Promise<boolean>;
  sendEmail(input: { to: string; name: string; subject: string; html: string; text: string }): Promise<SendOutcome>;
  sendSms(input: { email: string; phone: string; name: string; message: string }): Promise<SendOutcome>;
};

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function smsDefinitelyNotSent(reason: string) {
  return reason === 'relay_key_missing' || reason.startsWith('relay_send_sms_http_401:') || reason === 'relay_send_sms_http_503:vlix_oauth_not_connected';
}
export function emailDefinitelyNotSent(reason: string) {
  return reason === 'relay_key_missing' || reason.startsWith('relay_send_email_http_401:') || reason === 'relay_send_email_http_503:vlix_oauth_not_connected';
}

/** Process one claimed queue row. Returns the per-channel results. */
export async function processQueueRow(deps: Deps, row: QueueRow): Promise<Record<string, string>> {
  const order = await deps.readOrder(row.order_id);
  if (!order || order.status === 'pending_payment' || !order.tracking_number) {
    await deps.finishRow(row, 'suppressed', 'order_reopened_or_untracked');
    return { row: 'suppressed' };
  }
  const active = activePackages(order);
  if (!packagesToSend(active, row.new_keys, new Set()).length) {
    await deps.finishRow(row, 'suppressed', 'queued_tracking_no_longer_active');
    return { row: 'suppressed' };
  }
  const kit = isKitOrder(order.order_details);
  const details = objectDetails(order.order_details);
  const name = String(details.full_name ?? order.customer_name ?? '').trim();
  const email = String(order.customer_email ?? '').trim().toLowerCase();
  const results: Record<string, string> = {};
  const lastAttempt = row.attempts >= MAX_ATTEMPTS;

  for (const channel of ['email', 'sms'] as Channel[]) {
    const prior = await deps.notified(order.id, channel, row.id);
    const pkgs = packagesToSend(active, row.new_keys, prior.keys);
    if (!pkgs.length) { await deps.recordSkip(row, channel, 'already_notified'); results[channel] = 'skipped'; continue; }
    const keys = pkgs.map(p => p.key);
    if (!(await deps.claimChannel(row, channel, keys))) { results[channel] = 'already_claimed'; continue; }
    try {
      if (channel === 'email') {
        if (!validEmail(email)) { await deps.finishChannel(row, channel, { status: 'skipped', reason: 'no_buyer_email', keys }); results[channel] = 'skipped'; continue; }
        const msg = buildShippingEmail(order, pkgs, kit, prior.anySent);
        const r = await deps.sendEmail({ to: email, name, ...msg });
        results[channel] = await settle(deps, row, channel, r, email, keys, lastAttempt);
      } else {
        let phone = normalizePhone(typeof details.phone === 'string' ? details.phone : null);
        if (!phone && order.user_id && email) phone = normalizePhone(await deps.profilePhone(order.user_id, email));
        if (!phone) { await deps.finishChannel(row, channel, { status: 'skipped', reason: 'no_valid_buyer_phone', keys }); results[channel] = 'skipped'; continue; }
        if (details.sms_consent === false || details.sms_opt_in === false) { await deps.finishChannel(row, channel, { status: 'skipped', reason: 'customer_declined_sms', recipient: phone, keys }); results[channel] = 'skipped'; continue; }
        let opted: boolean;
        try { opted = await deps.optedOut(phone); } catch {
          results[channel] = await settle(deps, row, channel, { ok: false, reason: 'opt_out_check_failed', definitelyNotSent: true }, phone, keys, lastAttempt); continue;
        }
        if (opted) { await deps.finishChannel(row, channel, { status: 'skipped', reason: 'customer_opted_out', recipient: phone, keys }); results[channel] = 'skipped'; continue; }
        const r = await deps.sendSms({ email, phone, name, message: buildShippingSms(pkgs, kit, prior.anySent) });
        results[channel] = await settle(deps, row, channel, r, phone, keys, lastAttempt);
      }
    } catch (e) {
      await deps.finishChannel(row, channel, { status: 'uncertain', reason: (e instanceof Error ? e.message : 'send_error').slice(0, 300), keys });
      results[channel] = 'uncertain';
    }
  }
  const retry = Object.values(results).includes('retry');
  await deps.finishRow(row, retry ? 'retry' : 'done');
  results.row = retry ? 'retry' : 'done';
  return results;
}

async function settle(deps: Deps, row: QueueRow, channel: Channel, r: SendOutcome, recipient: string, keys: string[], lastAttempt: boolean) {
  if (r.ok) { await deps.finishChannel(row, channel, { status: 'sent', messageId: r.messageId, recipient, keys }); return 'sent'; }
  const status = !r.definitelyNotSent ? 'uncertain' : lastAttempt ? 'failed' : 'retry';
  await deps.finishChannel(row, channel, { status, reason: r.reason.slice(0, 400), recipient, keys });
  return status;
}
