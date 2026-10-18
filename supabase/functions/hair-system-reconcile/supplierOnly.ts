import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { attachExistingOrderIds, loadExpandedSession, stripeGet } from "../_shared/hairSystemFulfillment.ts";
import { HAIR_SYSTEM_SELLER_ACCOUNT, verifyPaidSession } from "../_shared/hairSystemFulfillmentLogic.ts";
import { buyerFromSession, DEFAULT_SUPPLIER_EMAIL, dispatchSupplierOrderNotifications } from "../_shared/hairSystemNotifications.ts";
import { relayProbe, RELAY_LOCATION_ID } from "../_shared/barberLaunchGhlRelay.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const defaults = { stripeGet, loadExpandedSession, attachExistingOrderIds, relayProbe, dispatchSupplierOrderNotifications };

/** Separate control flow: cannot enter full fulfillment or any buyer/CRM dispatch. */
export async function supplierOnlyRecovery(
  db: SupabaseClient,
  key: string,
  body: Record<string, unknown>,
  adminId: string,
  findSession: (db: SupabaseClient, key: string, orderId: string, userId: string | null) => Promise<string | null>,
  deps = defaults,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const reply = (status: number, result: Record<string, unknown>) => ({ status, body: result });
  const refuse = (reason: string) => reply(409, { error: reason, mode: body.action });
  const execute = body.action === "execute_supplier_only";
  const ids = body.order_ids === undefined ? [body.order_id] : body.order_ids;
  if (!Array.isArray(ids) || ids.length !== 1 || typeof ids[0] !== "string" || !UUID.test(ids[0]) ||
    (body.order_ids !== undefined && body.order_id !== undefined)) {
    return reply(400, { error: "Provide exactly one valid order UUID, without conflicting ID fields." });
  }
  const orderId = ids[0].toLowerCase();
  if (execute && body.confirm !== "EXECUTE_SUPPLIER_ONLY") return reply(400, { error: "Type EXECUTE_SUPPLIER_ONLY to confirm." });
  if (!/^(sk|rk)_live_/.test(key)) return refuse("live_stripe_key_required");
  const account = await deps.stripeGet("/account", key);
  if (account.id !== HAIR_SYSTEM_SELLER_ACCOUNT) return refuse("stripe_seller_mismatch");

  const { data: order, error: orderError } = await db.from("orders")
    .select("id, user_id, customer_email, customer_name, order_details, stripe_checkout_session_id")
    .eq("id", orderId).maybeSingle();
  if (orderError || !order || !UUID.test(String(order.user_id ?? ""))) return refuse("order_or_owner_unavailable");
  const sessionId = order.stripe_checkout_session_id || await findSession(db, key, orderId, order.user_id);
  if (typeof sessionId !== "string" || !/^cs_live_[A-Za-z0-9]+$/.test(sessionId)) return refuse("live_stripe_session_unavailable");
  const session = await deps.attachExistingOrderIds(db, await deps.loadExpandedSession(sessionId, key));
  const check = verifyPaidSession(session, { requireOrderId: orderId, expectedUserId: order.user_id });
  if (!check.ok) return refuse(`session_not_verified:${check.reason}`);
  if (session.id !== sessionId || session.livemode !== true) return refuse("session_identity_or_live_mode_mismatch");
  if (check.orderIds.length !== 1 || check.orderIds[0] !== orderId) return refuse("single_order_session_required");

  const { data: supplier, error: supplierError } = await db.from("order_notifications")
    .select("order_id, channel, status, reason, provider_message_id, attempts, event_id, updated_at")
    .eq("order_id", orderId).eq("channel", "supplier_email").maybeSingle();
  if (supplierError) return refuse("supplier_notification_unavailable");
  const current = supplier?.status ?? "missing";
  const action = current === "sent" ? "duplicate" : !supplier || current === "failed" ? "send_supplier_email" : "blocked";
  const result = {
    mode: body.action,
    verified: { orderId, sessionId, ok: true, livemode: true, stripeAccountMatches: true, amountPaid: session.amount_total, currency: session.currency, sessionOrderIds: check.orderIds },
    notification: supplier,
    plan: { orderId, channel: "supplier_email", current, action, recipient: DEFAULT_SUPPLIER_EMAIL, customerChannels: "unchanged", crm: "unchanged", requiresConfirm: "EXECUTE_SUPPLIER_ONLY" },
  };
  // No claim, notification write, relay call, or send in this branch.
  if (!execute) return reply(200, result);
  const { data: hold, error: holdError } = await db.from("app_settings").select("value").eq("key", "hair_system_fulfillment_hold").maybeSingle();
  if (holdError || hold?.value !== false) return refuse("fulfillment_held_or_unavailable");
  const relay = await deps.relayProbe();
  if (relay.ready !== true || !("locationId" in relay) || relay.locationId !== RELAY_LOCATION_ID) return refuse("approved_relay_not_ready");
  if (action === "duplicate") return reply(200, { ...result, outcomes: [{ channel: "supplier_email", result: "duplicate" }] });
  if (action === "blocked") return refuse("supplier_notification_not_unsent_or_failed");
  const outcomes = await deps.dispatchSupplierOrderNotifications(db, {
    orders: [order], buyer: buyerFromSession(session), eventId: `supplier-only:${adminId}:${sessionId}`,
  });
  return reply(200, { ...result, outcomes });
}