// Supplier notification for paid hair system orders.
//
// Stripe is the ONLY source of truth: this module is driven exclusively by a
// signature-verified successful Stripe Checkout event plus the hair-system
// order metadata captured at checkout. GoHighLevel is used ONLY as the
// delivery transport (supplier email, customer receipt + buyer SMS) — no GHL workflow, merge
// field, purchase trigger or legacy contact custom field ever contributes to
// message content.
//
// Every send is claimed atomically per (order, channel) so a Stripe retry can
// never send the supplier the same order twice, while a FAILED send can be
// retried later.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getGhlAccess,
  normalizePhone,
  resolveContactId,
  sendGhlEmail,
  sendGhlSms,
  type GhlAccess,
} from "./ghlMessaging.ts";

export const SUPPLIER_FROM = "send@barberlaunch.co";
export const SUPPLIER_FROM_NAME = "Barber Launch";
export const DEFAULT_SUPPLIER_EMAIL = "sales30@newtimeshair.com";
export const SUPPLIER_SUBJECT = "NEW Hair System Purchase (Order Details) (IMPORTANT)";
export const SUPPLIER_STANDING_INSTRUCTION = "Please always choose NCON and HS1.";
export const CUSTOMER_RECEIPT_SUBJECT = "Your Barber Launch Hair System Order Receipt";

export type Channel = "supplier_email" | "customer_receipt" | "customer_sms";

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

export type PaidReceipt = {
  orderReference: string;
  purchasedAt: Date;
  currency: string;
  amountPaid: number;
  lineItems: Array<{ name: string; quantity: number; amount: number }>;
  cardBrand: string;
  cardLast4: string;
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
 * Production specification rows built from the submitted order payload
 * (order_details). The internal client name is deliberately excluded from the
 * supplier sheet — all other current form fields appear verbatim, resolved to
 * their final customer-facing values (custom length/density substituted).
 */
function systemRows(details: Record<string, any> | null) {
  const rows: [string, string][] = [
    ["Hair color", details?.["Choose Color"]],
    ["Base (lace or skin)", details?.["Lace or Skin"]],
    ["Hair length", details?.["Hair Length"]],
    ["Density", details?.["Choose Density"]],
  ].filter(([, v]) => String(v ?? "").trim().length > 0) as [string, string][];
  const curl = curlLabel(details?.["Curl Pattern"]);
  if (curl) rows.push(["Curl pattern", curl]);
  return rows;
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase() || "USD",
  }).format(amount / 100);
}

function purchaseDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

/** Branded customer receipt. Prices come only from the paid Stripe Session. */
export function buildCustomerReceiptHtml(orders: OrderRow[], buyer: SessionBuyer, receipt: PaidReceipt) {
  const primary = orders[0];
  const details = primary?.order_details ?? {};
  const fullName = String(details.full_name ?? primary?.customer_name ?? buyer.name ?? "").trim();
  const firstName = fullName.split(/\s+/)[0] || "there";
  const ship = shippingBlock(details);
  const shipLines = ship.lines.length ? ship.lines : buyer.address;
  const items = receipt.lineItems.map((item) => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #e5e5e5">${esc(item.name)}${item.quantity > 1 ? ` &times; ${item.quantity}` : ""}</td>
    <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:700">${esc(money(item.amount, receipt.currency))}</td>
  </tr>`).join("");
  const systems = orders.map((order, index) => {
    const rows = systemRows(order.order_details)
      .map(([label, value]) => `<tr><td style="padding:3px 12px 3px 0;color:#666">${esc(label)}</td><td style="padding:3px 0;font-weight:700">${esc(value)}</td></tr>`)
      .join("");
    return `<div style="padding:14px 0;${index ? "border-top:1px solid #e5e5e5" : ""}">
      <h3 style="font-size:15px;margin:0 0 7px">Hair system ${index + 1}</h3>
      <table style="border-collapse:collapse;font-size:14px">${rows}<tr><td style="padding:3px 12px 3px 0;color:#666">Quantity</td><td style="padding:3px 0;font-weight:700">1</td></tr></table>
    </div>`;
  }).join("");
  const notes = String(details.notes ?? "").trim();
  const card = receipt.cardBrand && receipt.cardLast4
    ? `${receipt.cardBrand.replace(/^./, (c) => c.toUpperCase())} ending in ${receipt.cardLast4}`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:Helvetica,Arial,sans-serif;color:#171717">
<div style="max-width:640px;margin:0 auto;padding:24px 12px">
  <div style="background:#111;color:#d6ae52;padding:22px 24px;font-size:22px;font-weight:700">Barber Launch</div>
  <div style="background:#fff;padding:28px 24px">
    <div style="color:#247a46;font-size:13px;font-weight:700;text-transform:uppercase">Payment confirmed</div>
    <h1 style="font-size:25px;margin:7px 0 12px">Your hair system order receipt</h1>
    <p style="margin:0 0 7px">Hi ${esc(firstName)}, your payment was successful.</p>
    <p style="margin:0 0 22px">Customer name: ${esc(fullName)}${
      String(details["Client Name"] ?? "").trim()
        ? `<br>Client name: ${esc(String(details["Client Name"]).trim())}`
        : ""
    }</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
      <tr><td style="padding:4px 12px 4px 0;color:#666">Order reference</td><td style="padding:4px 0;text-align:right;font-weight:700">${esc(receipt.orderReference)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Purchase date</td><td style="padding:4px 0;text-align:right">${esc(purchaseDate(receipt.purchasedAt))}</td></tr>
    </table>
    <h2 style="font-size:17px;margin:22px 0 6px">Order summary</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${items}
      <tr><td style="padding:14px 0;font-size:16px;font-weight:700">Total paid</td><td style="padding:14px 0;text-align:right;font-size:17px;font-weight:700">${esc(money(receipt.amountPaid, receipt.currency))}</td></tr>
    </table>
    ${card ? `<p style="margin:0 0 24px;color:#666;font-size:13px">Paid with ${esc(card)}</p>` : ""}
    <h2 style="font-size:17px;margin:22px 0 6px">Production selections</h2>
    ${systems}
    <h2 style="font-size:17px;margin:22px 0 6px">Shipping</h2>
    ${ship.method ? `<p style="margin:0 0 7px"><strong>Shipping preference:</strong> ${esc(String(details.shipping?.method ?? ship.method))}</p>` : ""}
    <p style="margin:0;line-height:1.5">${shipLines.map(esc).join("<br>")}</p>
    ${notes ? `<h2 style="font-size:17px;margin:22px 0 6px">Order notes</h2><p style="margin:0;white-space:pre-wrap">${esc(notes)}</p>` : ""}
    <p style="margin:28px 0 0;border-top:1px solid #e5e5e5;padding-top:20px">Thank you for your order with Barber Launch.</p>
  </div>
</div></body></html>`;
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

// ── Supplier email delivery (GoHighLevel transport) ──────────
//
// Transport is the existing connected Barber Launch GHL location (same OAuth
// path as the other live functions). The rendered HTML is handed to GHL fully
// built — GHL contributes nothing to the content. The From address must be
// send@barberlaunch.co; if GHL refuses that sender the send FAILS and the
// exact provider rejection is recorded. No silent fallback sender.

export type SendResult =
  | { ok: true; messageId: string | null; sender: string }
  | { ok: false; reason: string; configured: boolean };

export async function sendSupplierEmail(
  db: SupabaseClient,
  input: { to: string; subject: string; html: string; access?: GhlAccess },
): Promise<SendResult> {
  const from =
    (Deno.env.get("HAIR_SYSTEM_SUPPLIER_FROM") ?? "").trim().toLowerCase() || SUPPLIER_FROM;

  const access = input.access ?? (await getGhlAccess(db));
  if ("error" in access) {
    return { ok: false, configured: false, reason: `ghl_not_available:${access.error}` };
  }

  const contactId = await resolveContactId(access, { email: input.to, name: "New Times Hair" });
  if (!contactId) {
    return { ok: false, configured: true, reason: "ghl_supplier_contact_unresolved" };
  }

  const res = await sendGhlEmail(access, {
    contactId,
    emailFrom: from,
    emailTo: input.to,
    subject: input.subject,
    html: input.html,
  });
  if (!res.ok) {
    const senderIssue = /from|sender|domain|verif|unauthor/i.test(res.reason);
    return {
      ok: false,
      configured: true,
      reason: `${senderIssue ? `ghl_sender_not_verified(${from}):` : "ghl_email_failed:"}${res.reason}`.slice(0, 400),
    };
  }
  return { ok: true, messageId: res.messageId, sender: from };
}

export async function sendCustomerReceiptEmail(
  db: SupabaseClient,
  input: { to: string; name: string; subject: string; html: string; access?: GhlAccess },
): Promise<SendResult> {
  const access = input.access ?? (await getGhlAccess(db));
  if ("error" in access) return { ok: false, configured: false, reason: `ghl_not_available:${access.error}` };
  const contactId = await resolveContactId(access, { email: input.to, name: input.name });
  if (!contactId) return { ok: false, configured: true, reason: "ghl_customer_contact_unresolved" };
  const res = await sendGhlEmail(access, {
    contactId,
    emailFrom: SUPPLIER_FROM,
    emailTo: input.to,
    subject: input.subject,
    html: input.html,
  });
  if (!res.ok) {
    const senderIssue = /from|sender|domain|verif|unauthor/i.test(res.reason);
    return { ok: false, configured: true, reason: `${senderIssue ? `ghl_sender_not_verified(${SUPPLIER_FROM}):` : "ghl_email_failed:"}${res.reason}`.slice(0, 400) };
  }
  return { ok: true, messageId: res.messageId, sender: SUPPLIER_FROM };
}

// ── Customer SMS (approved Barber Launch GHL SMS route) ──────

/** Short, transactional, no prices or card data. */
export function buildCustomerSmsBody(order: OrderRow, buyer: SessionBuyer, systemCount: number) {
  const details = order.order_details ?? {};
  const name = String(details.full_name ?? order.customer_name ?? buyer.name ?? "").split(" ")[0];
  const what = systemCount > 1 ? `${systemCount} hair systems are` : "hair system is";
  return `${name ? `${name}, ` : ""}thanks for your order with Barber Launch. Your ${what} confirmed and going into production. We'll be in touch with shipping updates. Reply STOP to opt out.`;
}

/** Same consent contract as Vlix Booking: valid number, not opted out, consent not withdrawn. */
async function smsAllowed(
  db: SupabaseClient,
  phone: string,
  details: Record<string, any> | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (details?.sms_consent === false || details?.sms_opt_in === false) {
    return { ok: false, reason: "customer_declined_sms" };
  }
  const { data, error } = await db
    .from("sms_opt_outs")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();
  if (error) return { ok: false, reason: `opt_out_check_failed:${error.message}`.slice(0, 300) };
  if (data) return { ok: false, reason: "customer_opted_out" };
  return { ok: true };
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
 * After a verified successful Stripe payment: one supplier production sheet
 * per ordered system, one branded customer receipt, and one transactional SMS
 * to the buyer through the connected Barber Launch GoHighLevel location.
 */
export async function dispatchPaidOrderNotifications(
  db: SupabaseClient,
  input: { orders: OrderRow[]; buyer: SessionBuyer; eventId: string; receipt: PaidReceipt },
): Promise<ChannelOutcome[]> {
  const orders = input.orders;
  if (!orders.length) return [];

  const supplierEmail =
    (Deno.env.get("HAIR_SYSTEM_SUPPLIER_EMAIL") ?? "").trim().toLowerCase() || DEFAULT_SUPPLIER_EMAIL;

  // One GHL token resolution for the whole dispatch.
  const accessResult = await getGhlAccess(db);
  const access = "error" in accessResult ? null : accessResult;
  const accessError = "error" in accessResult ? accessResult.error : null;

  const outcomes: ChannelOutcome[] = [];
  for (const order of orders) {
    outcomes.push(
      await runChannel(db, order.id, "supplier_email", input.eventId, async () => {
        const res = await sendSupplierEmail(db, {
          to: supplierEmail,
          subject: SUPPLIER_SUBJECT,
          html: buildSupplierEmailHtml(order, input.buyer),
          ...(access ? { access } : {}),
        });
        return res.ok
          ? { status: "sent", messageId: res.messageId, recipient: `${supplierEmail} (from: ${res.sender})` }
          : { status: "failed", reason: res.reason, recipient: supplierEmail };
      }),
    );
  }

  // One receipt per purchase, claimed against the first order so multi-system
  // purchases and Stripe retries cannot generate duplicate customer emails.
  const primary = orders[0];
  const customerEmail = String(input.buyer.email || primary.customer_email || "").trim().toLowerCase();
  outcomes.push(
    await runChannel(db, primary.id, "customer_receipt", input.eventId, async () => {
      if (!customerEmail) return { status: "skipped", reason: "no_buyer_email" };
      if (!access) return { status: "failed", reason: `ghl_not_available:${accessError}`, recipient: customerEmail };
      const details = primary.order_details ?? {};
      const res = await sendCustomerReceiptEmail(db, {
        to: customerEmail,
        name: String(details.full_name ?? primary.customer_name ?? input.buyer.name ?? ""),
        subject: CUSTOMER_RECEIPT_SUBJECT,
        html: buildCustomerReceiptHtml(orders, input.buyer, input.receipt),
        access,
      });
      return res.ok
        ? { status: "sent", messageId: res.messageId, recipient: `${customerEmail} (from: ${res.sender})` }
        : { status: "failed", reason: res.reason, recipient: customerEmail };
    }),
  );

  // One confirmation SMS per purchase, claimed against the first order so a
  // Stripe retry (or a multi-system order) can never text the buyer twice.
  outcomes.push(
    await runChannel(db, primary.id, "customer_sms", input.eventId, async () => {
      const details = primary.order_details ?? {};
      const phone = normalizePhone(details.phone ?? input.buyer.phone);
      if (!phone) return { status: "skipped", reason: "no_valid_buyer_phone" };

      const allowed = await smsAllowed(db, phone, details);
      if (!allowed.ok) return { status: "skipped", reason: allowed.reason, recipient: phone };

      if (!access) {
        return { status: "failed", reason: `ghl_not_available:${accessError}`, recipient: phone };
      }
      const contactId = await resolveContactId(access, {
        email: String(input.buyer.email || primary.customer_email || ""),
        phone,
        name: String(details.full_name ?? primary.customer_name ?? input.buyer.name ?? ""),
      });
      if (!contactId) return { status: "failed", reason: "ghl_buyer_contact_unresolved", recipient: phone };

      const res = await sendGhlSms(access, {
        contactId,
        phone,
        message: buildCustomerSmsBody(primary, input.buyer, orders.length),
      });
      return res.ok
        ? { status: "sent", messageId: res.messageId, recipient: phone }
        : { status: "failed", reason: res.reason, recipient: phone };
    }),
  );

  return outcomes;
}
