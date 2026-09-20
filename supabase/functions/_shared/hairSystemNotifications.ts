// Content builders + delivery dispatch for paid hair system orders.
//
// Every send is claimed atomically per (order, channel) so a Stripe retry or a
// duplicate delivery can never send the same message twice, while a FAILED
// channel can be retried later without touching the ones that succeeded.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getGhlAccess,
  normalizePhone,
  resolveContactId,
  sendGhlEmail,
  sendGhlSms,
  type GhlAccess,
} from "./ghlMessaging.ts";

export const RECEIPT_FROM = "send@barberlaunch.co";

export type Channel = "customer_email" | "customer_sms" | "supplier_email";

export type OrderRow = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  order_details: Record<string, any> | null;
};

export type PriceLine = { description: string; quantity: number; amountCents: number };

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function shippingBlock(details: Record<string, any> | null) {
  const s = details?.shipping ?? {};
  const lines = [
    s.address_1,
    s.address_2,
    [s.city, s.state].filter(Boolean).join(", "),
    s.zip,
  ].filter((v) => String(v || "").trim().length > 0);
  return { method: String(s.method || "").trim(), lines: lines.map(String) };
}

function systemRows(details: Record<string, any> | null) {
  return [
    ["Client name", details?.["Client Name"]],
    ["Color", details?.["Choose Color"]],
    ["Lace or skin", details?.["Lace or Skin"]],
    ["Hair length", details?.["Hair Length"]],
    ["Density", details?.["Choose Density"]],
    ["Curl pattern", details?.["Curl Pattern"]],
  ].filter(([, v]) => String(v ?? "").trim().length > 0) as [string, string][];
}

/** Customer receipt — prices included, never any card or payment-instrument data. */
export function buildCustomerReceiptHtml(input: {
  purchaserName: string;
  orders: OrderRow[];
  lines: PriceLine[];
  totalCents: number;
}) {
  const first = input.orders[0]?.order_details ?? null;
  const ship = shippingBlock(first);

  const systems = input.orders
    .map((order, index) => {
      const rows = systemRows(order.order_details)
        .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#777">${esc(k)}</td><td style="padding:2px 0"><strong>${esc(v)}</strong></td></tr>`)
        .join("");
      return `<div style="margin:0 0 16px"><div style="font-weight:700;margin-bottom:4px">System ${index + 1} of ${input.orders.length}</div><table style="border-collapse:collapse;font-size:14px">${rows}</table></div>`;
    })
    .join("");

  const priceRows = input.lines
    .map(
      (line) =>
        `<tr><td style="padding:4px 0">${esc(line.description)}${line.quantity > 1 ? ` &times; ${line.quantity}` : ""}</td><td style="padding:4px 0;text-align:right">${money(line.amountCents)}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;color:#111">
<div style="max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
  <h1 style="font-size:20px;margin:0 0 4px">Your order is confirmed</h1>
  <p style="margin:0 0 20px;color:#555;font-size:14px">Thanks, ${esc(input.purchaserName)} — we've received your payment and your order is in production.</p>

  <h2 style="font-size:15px;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:#8a6d3b">What you ordered</h2>
  ${systems}

  <h2 style="font-size:15px;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:#8a6d3b">Delivery</h2>
  <p style="margin:0 0 4px;font-size:14px"><strong>${esc(ship.method)}</strong></p>
  <p style="margin:0 0 20px;font-size:14px;color:#333">${ship.lines.map(esc).join("<br>")}</p>

  <h2 style="font-size:15px;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:#8a6d3b">Payment summary</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${priceRows}
    <tr><td style="padding:10px 0 0;border-top:1px solid #ddd;font-weight:700">Total paid</td><td style="padding:10px 0 0;border-top:1px solid #ddd;text-align:right;font-weight:700">${money(input.totalCents)}</td></tr>
  </table>

  <p style="margin:24px 0 0;font-size:12px;color:#888">Questions about this order? Just reply to this email.</p>
</div></body></html>`;
}

/**
 * Supplier production sheet. Contains ONLY production/shipping data.
 * Never any price, subtotal, shipping charge, total, Stripe id or payment wording.
 */
export function buildSupplierEmailHtml(order: OrderRow) {
  const details = order.order_details ?? {};
  const ship = shippingBlock(details);
  const rows = systemRows(details)
    .map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#777">${esc(k)}</td><td style="padding:3px 0"><strong>${esc(v)}</strong></td></tr>`)
    .join("");

  const notes = String(details.notes ?? "").trim();

  return `<!doctype html><html><body style="margin:0;font-family:Helvetica,Arial,sans-serif;color:#111">
<div style="max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:18px;margin:0 0 12px">Hair system production order</h1>
  <p style="margin:0 0 16px;font-size:13px;color:#555">Order reference: ${esc(order.id)}${
    details.total_orders ? ` &middot; system ${esc(details.order_number)} of ${esc(details.total_orders)}` : ""
  }</p>

  <h2 style="font-size:14px;margin:16px 0 6px">System specification</h2>
  <table style="border-collapse:collapse;font-size:14px">${rows}
    <tr><td style="padding:3px 14px 3px 0;color:#777">Quantity</td><td style="padding:3px 0"><strong>1</strong></td></tr>
  </table>

  <h2 style="font-size:14px;margin:20px 0 6px">Ship to</h2>
  <table style="border-collapse:collapse;font-size:14px">
    <tr><td style="padding:3px 14px 3px 0;color:#777">Recipient</td><td style="padding:3px 0"><strong>${esc(details.full_name ?? order.customer_name ?? "")}</strong></td></tr>
    <tr><td style="padding:3px 14px 3px 0;color:#777">Phone</td><td style="padding:3px 0">${esc(details.phone ?? "")}</td></tr>
    <tr><td style="padding:3px 14px 3px 0;color:#777">Method</td><td style="padding:3px 0">${esc(ship.method)}</td></tr>
    <tr><td style="padding:3px 14px 3px 0;color:#777;vertical-align:top">Address</td><td style="padding:3px 0">${ship.lines.map(esc).join("<br>")}</td></tr>
  </table>

  ${notes ? `<h2 style="font-size:14px;margin:20px 0 6px">Order notes</h2><p style="font-size:14px;white-space:pre-wrap;margin:0">${esc(notes)}</p>` : ""}
</div></body></html>`;
}

export function buildCustomerSms(purchaserFirstName: string) {
  const name = purchaserFirstName ? `${purchaserFirstName}, ` : "";
  return `${name}your Barber Launch hair system order is confirmed and paid. A full receipt is on its way to your email.`;
}

// ── Delivery dispatch ────────────────────────────────────────

async function finish(
  db: SupabaseClient,
  orderId: string,
  channel: Channel,
  update: { status: "sent" | "failed" | "skipped"; provider_message_id?: string | null; reason?: string | null; recipient_hint?: string | null },
) {
  const { error } = await db
    .from("order_notifications")
    .update({
      status: update.status,
      provider_message_id: update.provider_message_id ?? null,
      reason: update.reason ?? null,
      recipient_hint: update.recipient_hint ?? null,
    })
    .eq("order_id", orderId)
    .eq("channel", channel);
  if (error) console.error("notification log update failed", channel, error.message);
}

type ChannelOutcome = { channel: Channel; result: string; reason?: string };

async function runChannel(
  db: SupabaseClient,
  orderId: string,
  channel: Channel,
  eventId: string,
  send: () => Promise<{ status: "sent" | "failed" | "skipped"; messageId?: string | null; reason?: string | null; recipient?: string | null }>,
): Promise<ChannelOutcome> {
  const { data: claim, error } = await db.rpc("claim_order_notification", {
    _order_id: orderId,
    _channel: channel,
    _event_id: eventId,
  });
  if (error) return { channel, result: "claim_failed", reason: error.message };
  if (claim !== "claimed") return { channel, result: String(claim) };

  try {
    const outcome = await send();
    await finish(db, orderId, channel, {
      status: outcome.status,
      provider_message_id: outcome.messageId ?? null,
      reason: outcome.reason ?? null,
      recipient_hint: outcome.recipient ?? null,
    });
    return { channel, result: outcome.status, reason: outcome.reason ?? undefined };
  } catch (e) {
    const reason = e instanceof Error ? e.message.slice(0, 300) : "send_error";
    await finish(db, orderId, channel, { status: "failed", reason });
    return { channel, result: "failed", reason };
  }
}

/**
 * Sends the customer receipt + SMS once per paid checkout (anchored on the
 * first order of the session) and one supplier sheet per ordered system.
 */
export async function dispatchPaidOrderNotifications(
  db: SupabaseClient,
  input: { orders: OrderRow[]; lines: PriceLine[]; totalCents: number; eventId: string },
): Promise<ChannelOutcome[]> {
  const orders = input.orders;
  if (!orders.length) return [];
  const anchor = orders[0];
  const details = anchor.order_details ?? {};
  const purchaserName = String(details.full_name ?? anchor.customer_name ?? "").trim();
  const purchaserEmail = String(details.email ?? anchor.customer_email ?? "").trim().toLowerCase();
  const purchaserPhone = normalizePhone(details.phone ?? null);
  const supplierEmail = (Deno.env.get("HAIR_SYSTEM_SUPPLIER_EMAIL") ?? "").trim().toLowerCase();

  const access = await getGhlAccess(db);
  const outcomes: ChannelOutcome[] = [];

  if ("error" in access) {
    const reason = access.error;
    for (const channel of ["customer_email", "customer_sms"] as Channel[]) {
      outcomes.push(await runChannel(db, anchor.id, channel, input.eventId, async () => ({ status: "failed", reason })));
    }
    for (const order of orders) {
      outcomes.push(await runChannel(db, order.id, "supplier_email", input.eventId, async () => ({ status: "failed", reason })));
    }
    return outcomes;
  }
  const ghl = access as GhlAccess;

  const customerContactId = purchaserEmail
    ? await resolveContactId(ghl, { email: purchaserEmail, phone: purchaserPhone, name: purchaserName })
    : null;

  // 1) Customer receipt
  outcomes.push(
    await runChannel(db, anchor.id, "customer_email", input.eventId, async () => {
      if (!purchaserEmail) return { status: "skipped", reason: "no_customer_email" };
      if (!customerContactId) return { status: "failed", reason: "contact_unresolved" };
      const res = await sendGhlEmail(ghl, {
        contactId: customerContactId,
        emailFrom: RECEIPT_FROM,
        emailTo: purchaserEmail,
        subject: "Your Barber Launch hair system order receipt",
        html: buildCustomerReceiptHtml({ purchaserName, orders, lines: input.lines, totalCents: input.totalCents }),
      });
      return res.ok
        ? { status: "sent", messageId: res.messageId, recipient: purchaserEmail }
        : { status: "failed", reason: res.reason, recipient: purchaserEmail };
    }),
  );

  // 2) Customer SMS
  outcomes.push(
    await runChannel(db, anchor.id, "customer_sms", input.eventId, async () => {
      if (!purchaserPhone) return { status: "skipped", reason: "no_valid_phone" };
      if (!customerContactId) return { status: "failed", reason: "contact_unresolved" };
      const res = await sendGhlSms(ghl, {
        contactId: customerContactId,
        phone: purchaserPhone,
        message: buildCustomerSms(purchaserName.split(/\s+/)[0] ?? ""),
      });
      return res.ok
        ? { status: "sent", messageId: res.messageId, recipient: purchaserPhone }
        : { status: "failed", reason: res.reason, recipient: purchaserPhone };
    }),
  );

  // 3) Supplier production sheet, one per ordered system
  const supplierContactId = supplierEmail
    ? await resolveContactId(ghl, { email: supplierEmail, name: "Hair System Supplier" })
    : null;

  for (const order of orders) {
    outcomes.push(
      await runChannel(db, order.id, "supplier_email", input.eventId, async () => {
        if (!supplierEmail) return { status: "failed", reason: "supplier_email_not_configured" };
        if (!supplierContactId) return { status: "failed", reason: "supplier_contact_unresolved" };
        const res = await sendGhlEmail(ghl, {
          contactId: supplierContactId,
          emailFrom: RECEIPT_FROM,
          emailTo: supplierEmail,
          subject: `New hair system production order — ${String(order.order_details?.["Client Name"] ?? order.id).slice(0, 60)}`,
          html: buildSupplierEmailHtml(order),
        });
        return res.ok
          ? { status: "sent", messageId: res.messageId, recipient: supplierEmail }
          : { status: "failed", reason: res.reason, recipient: supplierEmail };
      }),
    );
  }

  return outcomes;
}
