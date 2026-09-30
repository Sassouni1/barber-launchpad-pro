// Single post-payment pipeline for hair-system orders, shared by the signed
// Stripe webhook (primary), the paid return-URL verification (fallback) and the
// admin reconciliation replay. Every send is claimed per (order, channel) in
// order_notifications, so no path can duplicate a delivery.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncPaidBuyerToGhl, type CrmSyncResult } from "./ghlCrmSync.ts";
import { buyerFromSession, dispatchPaidOrderNotifications, type OrderRow } from "./hairSystemNotifications.ts";
import { verifyPaidSession } from "./hairSystemFulfillmentLogic.ts";

/** Same key for checkout, webhook and reconciliation (Invasion Digital Media). */
export function hairSystemStripeKey(): string | null {
  return Deno.env.get("HAIR_SYSTEM_STRIPE_SECRET_KEY") || Deno.env.get("STRIPE_SECRET_KEY") || null;
}

export async function stripeGet(path: string, secret: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, { headers: { Authorization: `Bearer ${secret}` } });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? `stripe_http_${res.status}`);
  return body;
}

export function loadExpandedSession(sessionId: string, secret: string) {
  return stripeGet(
    `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items.data.price.product&expand[]=payment_intent.payment_method`,
    secret,
  );
}

const t = (v: unknown, n = 200) => String(v ?? "").trim().slice(0, n);

export type FulfillmentResult = {
  orderIds: string[];
  crm: CrmSyncResult;
  outcomes: Array<{ channel: string; result: string; reason?: string }>;
  anyFailed: boolean;
};

/**
 * `session` must be a freshly retrieved, expanded Checkout Session.
 * Re-verifies paid status itself; never trusts the caller.
 */
export async function fulfillPaidSession(
  db: SupabaseClient,
  session: Record<string, any>,
  opts: { eventId: string; stripeSecret: string; syncSavedCard: boolean; expectedUserId?: string },
): Promise<FulfillmentResult> {
  const check = verifyPaidSession(session, { expectedUserId: opts.expectedUserId });
  if (!check.ok) throw new Error(`session_not_verified:${check.reason}`);
  const orderIds = check.orderIds;

  // Paid state first; a later GHL failure never rolls this back.
  const { error: statusError } = await db.from("orders").update({ status: "pending" }).in("id", orderIds).eq("status", "pending_payment");
  if (statusError) throw statusError;

  if (opts.syncSavedCard && session.metadata?.save_card === "true" && typeof session.customer === "string" && session.metadata?.user_id) {
    try {
      const pm = session.payment_intent?.payment_method;
      const pmId = typeof pm === "string" ? pm : pm?.id;
      if (pmId) {
        await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(session.customer)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${opts.stripeSecret}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ "invoice_settings[default_payment_method]": pmId }),
        });
        await db.from("member_billing_profiles").upsert(
          { customer_id: session.metadata.user_id, stripe_customer_id: session.customer, default_payment_method_id: pmId },
          { onConflict: "customer_id" },
        );
      }
    } catch (e) {
      console.error("saved-card sync failed", e instanceof Error ? e.message : e);
    }
  }

  const { data: rows, error } = await db.from("orders").select("id, customer_email, customer_name, order_details").in("id", orderIds);
  if (error) throw error;
  const orders = orderIds.map((id) => (rows ?? []).find((o: any) => o.id === id)).filter(Boolean) as OrderRow[];
  if (!orders.length) throw new Error("orders_not_found");
  const details = (orders[0].order_details ?? {}) as Record<string, any>;

  let crm: CrmSyncResult;
  try {
    crm = await syncPaidBuyerToGhl(db, {
      orderId: orders[0].id,
      eventId: opts.eventId,
      buyer: {
        name: t(session.customer_details?.name || orders[0].customer_name || details.full_name, 120),
        email: t(session.customer_details?.email || orders[0].customer_email).toLowerCase(),
        phone: t(session.customer_details?.phone || details.phone, 40),
      },
      systemCount: orders.length,
      amountPaid: typeof session.amount_total === "number" ? session.amount_total : null,
      currency: t(session.currency, 10) || "usd",
    });
  } catch (e) {
    crm = { status: "failed", reason: e instanceof Error ? e.message.slice(0, 300) : "crm_sync_error" };
  }

  const lineItems = Array.isArray(session.line_items?.data)
    ? session.line_items.data.map((item: any) => ({
        name: String(item.description ?? item.price?.product?.name ?? "Hair system order"),
        quantity: Number(item.quantity ?? 1),
        amount: Number(item.amount_total ?? 0),
      }))
    : [];
  const pm = session.payment_intent?.payment_method;
  const card = pm && typeof pm === "object" ? pm.card : null;

  const outcomes = await dispatchPaidOrderNotifications(db, {
    orders,
    buyer: buyerFromSession(session),
    eventId: opts.eventId,
    receipt: {
      orderReference: String(session.id ?? orders[0].id),
      purchasedAt: new Date(Number(session.created ?? Date.now() / 1000) * 1000),
      currency: String(session.currency ?? "usd"),
      amountPaid: Number(session.amount_total ?? 0),
      lineItems,
      cardBrand: String(card?.brand ?? ""),
      cardLast4: String(card?.last4 ?? ""),
    },
  });

  const all = [{ channel: "crm_sync", result: crm.status === "synced" ? "sent" : crm.status, reason: crm.reason }, ...outcomes];
  return {
    orderIds,
    crm,
    outcomes: all,
    anyFailed: all.some((o) => o.result === "failed" || o.result === "claim_failed"),
  };
}
