// Buyer sync into the installed GoHighLevel Marketplace OAuth connection for
// The Barber Launch location, triggered ONLY after Stripe confirms a checkout
// session is paid.
//
// Transport: the Barber Launch GHL relay (existing Vlix Booking Marketplace
// connector). Upserts the contact with the Hair System Purchase tag and a
// complete order note. Sends no email.
//
// A GHL failure is reported, never allowed to change a confirmed Stripe
// payment or order status.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "./ghlMessaging.ts";
import { relayCall } from "./barberLaunchGhlRelay.ts";

export const BARBER_LAUNCH_LOCATION_ID = "JVBUuL3dVwZahuGay9T1";
export const CRM_SOURCE = "Barber Launch Hair Systems";
export const CRM_TAG = "Hair System Purchase";
export const CRM_EMAIL_SUBJECT = "Order received — The Barber Launch Hair Systems";
const CRM_FROM = "send@barberlaunch.co";

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export type CrmBuyer = {
  name: string;
  email: string;
  phone?: string | null;
};

export type CrmSyncResult = {
  status: "synced" | "duplicate" | "in_progress" | "skipped" | "failed";
  reason?: string;
  contactId?: string | null;
  messageId?: string | null;
};

function money(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

export function buildOrderReceivedEmailHtml(input: {
  buyerName: string;
  systemCount: number;
  amountPaid?: number | null;
  currency?: string | null;
}) {
  const first = input.buyerName.trim().split(/\s+/)[0] || "there";
  const count = Math.max(1, input.systemCount);
  const total = money(input.amountPaid, input.currency);
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#0f0f0f;font-family:Arial,Helvetica,sans-serif;color:#f5f5f5;">
  <div style="max-width:560px;margin:0 auto;background:#161616;border:1px solid #c9a227;border-radius:12px;padding:24px;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#c9a227;">Order received</h1>
    <p style="margin:0 0 12px;">Hi ${esc(first)}, we've received your order with The Barber Launch Hair Systems.</p>
    <p style="margin:0 0 12px;">Hair systems ordered: <strong>${count}</strong></p>
    ${total ? `<p style="margin:0 0 12px;">Total paid: <strong>${esc(total)}</strong></p>` : ""}
    <p style="margin:0 0 12px;">Our team will follow up with shipping information as soon as your order is on its way.</p>
    <p style="margin:24px 0 0;color:#b9b9b9;font-size:13px;">— The Barber Launch Team</p>
  </div>
</body></html>`;
}

/**
 * Idempotent per (order, 'crm_sync'): the first verified paid event wins, so a
 * refreshed return URL or a Stripe retry can never duplicate the contact sync
 * or the buyer email. Failures are logged and surfaced, never thrown.
 */
export async function syncPaidBuyerToGhl(
  db: SupabaseClient,
  input: {
    orderId: string;
    eventId: string;
    buyer: CrmBuyer;
    systemCount: number;
    amountPaid?: number | null;
    currency?: string | null;
    note: string;
  },
): Promise<CrmSyncResult> {
  const email = String(input.buyer.email || "").trim().toLowerCase();
  if (!email) return { status: "skipped", reason: "no_buyer_email" };

  const { data: claim, error: claimError } = await db.rpc("claim_order_notification", {
    _order_id: input.orderId,
    _channel: "crm_sync",
    _event_id: input.eventId,
  });
  if (claimError) return { status: "failed", reason: `claim_failed:${claimError.message}`.slice(0, 300) };
  if (claim !== "claimed") {
    return { status: claim === "duplicate" ? "duplicate" : "in_progress" };
  }

  const finish = async (status: "sent" | "failed" | "skipped", reason?: string, messageId?: string | null) => {
    const { error } = await db
      .from("order_notifications")
      .update({
        status,
        reason: reason ?? null,
        provider_message_id: messageId ?? null,
        recipient_hint: email,
      })
      .eq("order_id", input.orderId)
      .eq("channel", "crm_sync");
    if (error) console.error("crm_sync log update failed", error.message);
  };

  try {
    // Contact upsert + tag + note only. The buyer receipt is the separate
    // customer_receipt channel — no second "order received" email here.
    const note = input.note.includes(input.orderId) ? input.note : `Order ID: ${input.orderId}\n${input.note}`;
    const r = await relayCall("upsert_order_contact", {
      orderId: input.orderId,
      email,
      name: input.buyer.name.trim() || email,
      phone: normalizePhone(input.buyer.phone) ?? "",
      note,
    });
    if (!r.ok) {
      await finish("failed", r.reason);
      return { status: "failed", reason: r.reason };
    }
    await finish("sent", undefined, r.contactId ?? null);
    return { status: "synced", contactId: r.contactId ?? null };
  } catch (e) {
    const reason = e instanceof Error ? e.message.slice(0, 300) : "crm_sync_error";
    await finish("failed", reason);
    return { status: "failed", reason };
  }
}
