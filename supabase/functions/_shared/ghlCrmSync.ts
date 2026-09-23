// Buyer sync into the installed GoHighLevel Marketplace OAuth connection for
// The Barber Launch location, triggered ONLY after Stripe confirms a checkout
// session is paid.
//
// Strictly OAuth: the stored ghl_oauth_tokens connection (encrypted through
// app_secrets + GHL_ENCRYPTION_KEY, refreshed and re-encrypted near
// expiration by getGhlAccess). No private-integration token is ever used.
//
// A GHL failure is reported, never allowed to change a confirmed Stripe
// payment or order status.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  GHL_BASE,
  getGhlAccess,
  ghlHeaders,
  normalizePhone,
  type GhlAccess,
} from "./ghlMessaging.ts";

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

/** OAuth-only access to the connected Barber Launch location. */
async function oauthAccess(db: SupabaseClient): Promise<GhlAccess | { error: string }> {
  const { data: tokenRecord, error } = await db
    .from("ghl_oauth_tokens")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (error) return { error: `ghl_oauth_lookup_failed:${error.message}` };
  if (!tokenRecord) return { error: "ghl_marketplace_not_connected" };
  // getGhlAccess performs the secure refresh + re-encryption when the stored
  // token is near expiration.
  return await getGhlAccess(db);
}

/** Create or update the buyer contact with the purchase source and tag. */
async function upsertContact(access: GhlAccess, buyer: CrmBuyer): Promise<{ id: string } | { error: string }> {
  const parts = buyer.name.trim().split(/\s+/).filter(Boolean);
  const phone = normalizePhone(buyer.phone);
  const body: Record<string, unknown> = {
    locationId: access.locationId,
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" ") || "",
    name: buyer.name.trim() || buyer.email,
    email: buyer.email,
    source: CRM_SOURCE,
    tags: [CRM_TAG],
  };
  if (phone) body.phone = phone;

  try {
    const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: "POST",
      headers: ghlHeaders(access.accessToken),
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) {
      return { error: `ghl_contact_upsert_http_${res.status}:${JSON.stringify(payload).slice(0, 200)}` };
    }
    const id = (payload as any)?.contact?.id ?? (payload as any)?.id ?? null;
    if (!id) return { error: "ghl_contact_upsert_no_id" };
    return { id: String(id) };
  } catch (e) {
    return { error: e instanceof Error ? e.message.slice(0, 200) : "ghl_contact_upsert_error" };
  }
}

async function sendOrderReceivedEmail(
  access: GhlAccess,
  contactId: string,
  buyer: CrmBuyer,
  html: string,
): Promise<{ messageId: string | null } | { error: string }> {
  try {
    const res = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: ghlHeaders(access.accessToken),
      body: JSON.stringify({
        type: "Email",
        contactId,
        emailFrom: CRM_FROM,
        emailTo: buyer.email,
        subject: CRM_EMAIL_SUBJECT,
        html,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return { error: `ghl_email_http_${res.status}:${detail}` };
    }
    const payload = await res.json().catch(() => ({} as any));
    return { messageId: payload?.messageId ?? payload?.msgId ?? payload?.conversationId ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message.slice(0, 200) : "ghl_email_error" };
  }
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
    const access = await oauthAccess(db);
    if ("error" in access) {
      await finish("failed", access.error);
      return { status: "failed", reason: access.error };
    }
    if (access.locationId !== BARBER_LAUNCH_LOCATION_ID) {
      console.warn("crm_sync: connected location", access.locationId, "expected", BARBER_LAUNCH_LOCATION_ID);
    }

    const contact = await upsertContact(access, { ...input.buyer, email });
    if ("error" in contact) {
      await finish("failed", contact.error);
      return { status: "failed", reason: contact.error };
    }

    const html = buildOrderReceivedEmailHtml({
      buyerName: input.buyer.name,
      systemCount: input.systemCount,
      amountPaid: input.amountPaid,
      currency: input.currency,
    });
    const sent = await sendOrderReceivedEmail(access, contact.id, { ...input.buyer, email }, html);
    if ("error" in sent) {
      await finish("failed", sent.error);
      return { status: "failed", reason: sent.error, contactId: contact.id };
    }

    await finish("sent", null ?? undefined, sent.messageId);
    return { status: "synced", contactId: contact.id, messageId: sent.messageId };
  } catch (e) {
    const reason = e instanceof Error ? e.message.slice(0, 300) : "crm_sync_error";
    await finish("failed", reason);
    return { status: "failed", reason };
  }
}
