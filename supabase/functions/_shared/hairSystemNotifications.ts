// Supplier notification for paid hair system orders.
//
// Stripe is the ONLY source of truth: this module is driven exclusively by a
// signature-verified successful Stripe Checkout event plus the hair-system
// order metadata captured at checkout. It never reads or writes GoHighLevel
// contacts, custom fields, email or SMS.
//
// The customer receives Stripe's own native successful-payment receipt at the
// email supplied to Checkout — no duplicate receipt or SMS is sent from here.
//
// Every send is claimed atomically per (order, channel) so a Stripe retry can
// never send the supplier the same order twice, while a FAILED send can be
// retried later.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPPLIER_FROM = "send@barberlaunch.co";
export const SUPPLIER_FROM_NAME = "Barber Launch";
export const DEFAULT_SUPPLIER_EMAIL = "sales30@newtimeshair.com";
export const SUPPLIER_SUBJECT = "NEW Hair System Purchase (Order Details) (IMPORTANT)";
export const SUPPLIER_STANDING_INSTRUCTION = "Please always choose NCON and HS1.";

export type Channel = "supplier_email";

export type OrderRow = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  order_details: Record<string, any> | null;
};

/** Buyer facts taken from the paid Stripe Checkout Session itself. */
export type SessionBuyer = {
  name: string;
  email: string;
  phone: string;
  address: string[];
};

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Buyer identity/address straight off the paid Stripe session. */
export function buyerFromSession(session: Record<string, any>): SessionBuyer {
  const details = session?.customer_details ?? {};
  const addr =
    session?.shipping_details?.address ??
    session?.collected_information?.shipping_details?.address ??
    details?.address ??
    {};
  const lines = [
    addr.line1,
    addr.line2,
    [addr.city, addr.state].filter(Boolean).join(", "),
    [addr.postal_code, addr.country].filter(Boolean).join(" "),
  ]
    .map((v) => String(v ?? "").trim())
    .filter((v) => v.length > 0);
  return {
    name: String(session?.shipping_details?.name ?? details.name ?? "").trim(),
    email: String(details.email ?? "").trim(),
    phone: String(details.phone ?? "").trim(),
    address: lines,
  };
}

function shippingBlock(details: Record<string, any> | null) {
  const s = details?.shipping ?? {};
  const lines = [
    s.address_1,
    s.address_2,
    [s.city, s.state].filter(Boolean).join(", "),
    s.zip,
  ].filter((v) => String(v || "").trim().length > 0);
  // The stored method label carries the customer-facing price ("Rush Ship
  // (3 Days) · $50"); the supplier must never see any amount.
  const method = String(s.method || "")
    .replace(/[·|-]?\s*\$\s*[\d,]+(\.\d{2})?/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[·\-\s]+$/, "")
    .trim();
  return { method, lines: lines.map(String) };
}

/**
 * Exact customer-facing curl label, matching the order form's picker:
 * "Standard" is shown as "Standard · 3.0 CM", "Extra straight" as
 * "Extra straight · 4.0 CM"; numbered patterns ("2.8 CM" …) and
 * "Wave unit" already carry their customer-facing value.
 */
function curlLabel(raw: unknown): string {
  const v = String(raw ?? "").trim();
  if (v === "Standard") return "Standard · 3.0 CM";
  if (v === "Extra straight") return "Extra straight · 4.0 CM";
  return v;
}

/**
 * Every field of the CURRENT order form, per system, built from the
 * submitted order payload (order_details) — never from a legacy field list.
 * The checkout function stores each system already resolved to its final
 * customer-facing value (custom length/density substituted), so we surface
 * each one verbatim.
 */
function systemRows(details: Record<string, any> | null) {
  const rows: [string, string][] = [
    ["Client name", details?.["Client Name"]],
    ["Hair color", details?.["Choose Color"]],
    ["Base (lace or skin)", details?.["Lace or Skin"]],
    ["Hair length", details?.["Hair Length"]],
    ["Density", details?.["Choose Density"]],
  ].filter(([, v]) => String(v ?? "").trim().length > 0) as [string, string][];
  const curl = curlLabel(details?.["Curl Pattern"]);
  if (curl) rows.push(["Curl pattern", curl]);
  return rows;
}

/**
 * Supplier production sheet. Contains ONLY production/shipping data.
 * Never any price, subtotal, shipping charge, total, payment amount,
 * Stripe id, payment wording or card data.
 */
export function buildSupplierEmailHtml(order: OrderRow, buyer: SessionBuyer) {
  const details = order.order_details ?? {};
  const ship = shippingBlock(details);
  const rows = systemRows(details)
    .map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#777">${esc(k)}</td><td style="padding:3px 0"><strong>${esc(v)}</strong></td></tr>`)
    .join("");

  const notes = String(details.notes ?? "").trim();
  const shipLines = ship.lines.length ? ship.lines : buyer.address;
  const recipient = String(details.full_name ?? order.customer_name ?? buyer.name ?? "");
  const phone = String(details.phone ?? buyer.phone ?? "");
  const email = String(buyer.email || details.email || order.customer_email || "");

  return `<!doctype html><html><body style="margin:0;font-family:Helvetica,Arial,sans-serif;color:#111">
<div style="max-width:620px;margin:0 auto;padding:24px">
  <h1 style="font-size:18px;margin:0 0 12px">New hair system purchase — order details</h1>
  <p style="margin:0 0 16px;font-size:13px;color:#555">Order reference: ${esc(order.id)}${
    details.total_orders ? ` &middot; system ${esc(details.order_number)} of ${esc(details.total_orders)}` : ""
  }</p>

  <p style="margin:0 0 20px;padding:10px 12px;background:#fff6d6;border-left:4px solid #b8860b;font-size:15px"><strong>${esc(SUPPLIER_STANDING_INSTRUCTION)}</strong></p>

  <h2 style="font-size:14px;margin:16px 0 6px">System specification</h2>
  <table style="border-collapse:collapse;font-size:14px">${rows}
    <tr><td style="padding:3px 14px 3px 0;color:#777">Quantity</td><td style="padding:3px 0"><strong>1</strong></td></tr>
  </table>

  <h2 style="font-size:14px;margin:20px 0 6px">Buyer &amp; shipping</h2>
  <table style="border-collapse:collapse;font-size:14px">
    <tr><td style="padding:3px 14px 3px 0;color:#777">Buyer name</td><td style="padding:3px 0"><strong>${esc(recipient)}</strong></td></tr>
    <tr><td style="padding:3px 14px 3px 0;color:#777">Email</td><td style="padding:3px 0">${esc(email)}</td></tr>
    ${phone ? `<tr><td style="padding:3px 14px 3px 0;color:#777">Phone</td><td style="padding:3px 0">${esc(phone)}</td></tr>` : ""}
    ${ship.method ? `<tr><td style="padding:3px 14px 3px 0;color:#777">Shipping preference</td><td style="padding:3px 0">${esc(ship.method)}</td></tr>` : ""}
    <tr><td style="padding:3px 14px 3px 0;color:#777;vertical-align:top">Shipping address</td><td style="padding:3px 0">${shipLines.map(esc).join("<br>")}</td></tr>
  </table>

  ${notes ? `<h2 style="font-size:14px;margin:20px 0 6px">Order notes</h2><p style="font-size:14px;white-space:pre-wrap;margin:0">${esc(notes)}</p>` : ""}
</div></body></html>`;
}

// ── Email delivery (GoHighLevel = transport only) ────────────
//
// GHL is used strictly as the mail transport for the rendered supplier email.
// No GHL custom fields, workflow merge parameters or legacy contact data are
// read to build the message — the content comes only from the paid Stripe
// session and the submitted order payload.

export type SendResult =
  | { ok: true; messageId: string | null; sender: string }
  | { ok: false; reason: string; configured: boolean };

/**
 * Delivers the rendered supplier email through the connected GHL location.
 *
 * Sender selection: `send@barberlaunch.co` is attempted first (or the
 * HAIR_SYSTEM_SUPPLIER_FROM override). If GHL rejects that address because it
 * is not a verified sender on the location, we retry letting GHL apply the
 * account's own verified default sender, and report which one was used.
 */
export async function sendSupplierEmail(
  db: SupabaseClient,
  input: { to: string; subject: string; html: string },
): Promise<SendResult> {
  const access = await getGhlAccess(db);
  if ("error" in access) {
    return { ok: false, configured: false, reason: `email_provider_not_configured:${access.error}` };
  }

  // Transport needs a conversation target; the supplier's own address is used.
  const contactId = await resolveContactId(access, { email: input.to, name: "New Times Hair Supplier" });
  if (!contactId) {
    return { ok: false, configured: true, reason: "ghl_supplier_contact_unavailable" };
  }

  const preferredFrom =
    (Deno.env.get("HAIR_SYSTEM_SUPPLIER_FROM") ?? "").trim().toLowerCase() || SUPPLIER_FROM;

  const attempt = async (from?: string) =>
    await sendGhlEmail(access, {
      contactId,
      ...(from ? { emailFrom: from } : {}),
      emailTo: input.to,
      subject: input.subject,
      html: input.html,
    } as Parameters<typeof sendGhlEmail>[1]);

  const first = await attempt(preferredFrom);
  if (first.ok) return { ok: true, messageId: first.messageId, sender: preferredFrom };

  // Unverified/rejected sender → fall back to the location's default sender.
  const fallback = await attempt(undefined);
  if (fallback.ok) {
    return { ok: true, messageId: fallback.messageId, sender: "ghl_location_default_sender" };
  }
  return {
    ok: false,
    configured: true,
    reason: `${first.reason} | default_sender:${fallback.reason}`.slice(0, 400),
  };
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
 * Sends one supplier production sheet per ordered system after a verified
 * successful Stripe payment. No customer messaging happens here — Stripe's
 * native receipt covers the buyer.
 */
export async function dispatchPaidOrderNotifications(
  db: SupabaseClient,
  input: { orders: OrderRow[]; buyer: SessionBuyer; eventId: string },
): Promise<ChannelOutcome[]> {
  const orders = input.orders;
  if (!orders.length) return [];

  const supplierEmail =
    (Deno.env.get("HAIR_SYSTEM_SUPPLIER_EMAIL") ?? "").trim().toLowerCase() || DEFAULT_SUPPLIER_EMAIL;

  const outcomes: ChannelOutcome[] = [];
  for (const order of orders) {
    outcomes.push(
      await runChannel(db, order.id, "supplier_email", input.eventId, async () => {
        const res = await sendSupplierEmail({
          to: supplierEmail,
          subject: SUPPLIER_SUBJECT,
          html: buildSupplierEmailHtml(order, input.buyer),
        });
        return res.ok
          ? { status: "sent", messageId: res.messageId, recipient: supplierEmail }
          : { status: "failed", reason: res.reason, recipient: supplierEmail };
      }),
    );
  }
  return outcomes;
}
