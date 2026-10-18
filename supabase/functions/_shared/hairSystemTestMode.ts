// Isolated Stripe TEST-mode hair-system pipeline. Never sends email/SMS and
// never touches production orders, notifications, GHL or the Vlix relay:
// every "notification" is written to hair_system_test_notifications only.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadExpandedSession } from "./hairSystemFulfillment.ts";
import { stripeReceiptSnapshot } from "./hairSystemReceipt.ts";
import {
  DEFAULT_SUPPLIER_EMAIL, SUPPLIER_SUBJECT, CUSTOMER_RECEIPT_SUBJECT,
  buildSupplierEmailHtml, buildCustomerReceiptHtml, buildCustomerSmsBody, buyerFromSession,
  type OrderRow,
} from "./hairSystemNotifications.ts";

/** Dedicated test key only; refuses anything that is not visibly test-mode. */
export function hairSystemTestStripeKey(): string | null {
  const key = Deno.env.get("HAIR_SYSTEM_STRIPE_TEST_SECRET_KEY") ?? "";
  return /^(sk|rk)_test_/.test(key) ? key : null;
}
export function hairSystemTestPublishableKey(): string | null {
  const key = Deno.env.get("HAIR_SYSTEM_STRIPE_TEST_PUBLISHABLE_KEY") ?? "";
  return key.startsWith("pk_test_") ? key : null;
}

// Same amounts as the live catalog (hair-system-checkout priceIds), in cents.
const AMOUNTS = { standard: 20000, custom14: 26250, custom16: 31500, curly: 3000, wave: 5000, rush: 5000, shipping: 1000 };
const NAMES = { standard: "Standard Men's System (5 inch)", custom14: "Custom 14-inch System", custom16: "Custom 16-inch System", curly: "Curly Pattern Add-On", wave: "Wave Unit Add-On", rush: "Rush Shipping", shipping: "Shipping" };

export function testLineItems(systems: Record<string, unknown>[], shippingSpeed: string) {
  const q = new Map<keyof typeof AMOUNTS, number>();
  const add = (k: keyof typeof AMOUNTS) => q.set(k, (q.get(k) ?? 0) + 1);
  for (const s of systems) {
    const other = String(s.lengthOther ?? "").trim();
    add(s.length === "Other" && other === '14" hair' ? "custom14" : s.length === "Other" && other === '16" hair' ? "custom16" : "standard");
    const curl = String(s.curl ?? "").trim();
    if (curl === "Wave unit") add("wave"); else if (curl && curl !== "Standard") add("curly");
  }
  if (shippingSpeed.startsWith("Rush")) add("rush");
  if (shippingSpeed === "Shipping · $10") add("shipping");
  return [...q.entries()].map(([k, quantity]) => ({ name: NAMES[k], unit_amount: AMOUNTS[k], quantity }));
}

const enc = new TextEncoder();
export async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => { const [k, v] = p.split("="); return [k?.trim(), v]; })) as Record<string, string>;
  const t = parts["t"], sig = parts["v1"];
  if (!t || !sig || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== sig.length) return false;
  let d = 0; for (let i = 0; i < expected.length; i++) d |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0;
}

/** Idempotent: unique (session, system) orders and (session, order, channel) captures. */
export async function processTestSession(db: SupabaseClient, sessionId: string, secret: string, expectedAdminId?: string) {
  if (!sessionId.startsWith("cs_test_")) throw new Error("not_a_test_session");
  const session = await loadExpandedSession(sessionId, secret);
  if (session.livemode !== false) throw new Error("livemode_session_rejected");
  if (session.metadata?.hair_system_test_mode !== "true") throw new Error("not_a_hair_system_test_session");
  if (session.payment_status !== "paid") return { paid: false };
  const draftId = String(session.metadata?.test_draft_id ?? "");
  const { data: draft } = await db.from("hair_system_test_drafts").select("*").eq("id", draftId).maybeSingle();
  if (!draft || draft.stripe_checkout_session_id !== sessionId) throw new Error("test_draft_mismatch");
  if (expectedAdminId && draft.admin_user_id !== expectedAdminId) throw new Error("test_draft_owner_mismatch");

  const receipt = stripeReceiptSnapshot(session);
  const systems = draft.systems as Record<string, unknown>[];
  const rows = systems.map((sys, i) => ({
    draft_id: draft.id, stripe_checkout_session_id: sessionId, system_index: i,
    customer_email: draft.customer_email, customer_name: draft.customer_name,
    order_details: { ...(draft.base_details as object), ...sys, order_number: i + 1, total_orders: systems.length, test_mode: true, stripe_receipt: receipt },
    receipt, amount_total_minor: receipt.total_minor, currency: receipt.currency,
  }));
  const { error: upErr } = await db.from("hair_system_test_orders").upsert(rows, { onConflict: "stripe_checkout_session_id,system_index", ignoreDuplicates: true });
  if (upErr) throw new Error(`test_order_write_failed:${upErr.message}`);
  const { data: orders } = await db.from("hair_system_test_orders").select("id, customer_email, customer_name, order_details").eq("stripe_checkout_session_id", sessionId).order("system_index");
  if (!orders?.length) throw new Error("test_orders_missing");

  const buyer = buyerFromSession(session);
  const pm = session.payment_intent?.payment_method;
  const card = pm && typeof pm === "object" ? pm.card : null;
  const paid = {
    orderReference: sessionId, purchasedAt: new Date(Number(session.created) * 1000), currency: String(session.currency ?? "usd"),
    amountPaid: Number(session.amount_total ?? 0),
    lineItems: (session.line_items?.data ?? []).map((it: any) => ({ name: String(it.description ?? "Hair system order"), quantity: Number(it.quantity ?? 1), amount: Number(it.amount_total ?? 0) })),
    cardBrand: String(card?.brand ?? ""), cardLast4: String(card?.last4 ?? ""),
  };
  const o = orders as OrderRow[];
  const captures = [
    ...o.map((order) => ({ test_order_id: order.id, channel: "supplier_email", intended_recipient: DEFAULT_SUPPLIER_EMAIL, subject: SUPPLIER_SUBJECT, body: buildSupplierEmailHtml(order, buyer) })),
    { test_order_id: o[0].id, channel: "customer_receipt", intended_recipient: buyer.email || draft.customer_email, subject: CUSTOMER_RECEIPT_SUBJECT, body: buildCustomerReceiptHtml(o, buyer, paid) },
    { test_order_id: o[0].id, channel: "customer_sms", intended_recipient: buyer.phone || "(none)", subject: null, body: buildCustomerSmsBody(o[0], buyer, o.length) },
  ].map((c) => ({ ...c, stripe_checkout_session_id: sessionId, status: "captured_not_sent", outbound_calls: 0 }));
  // Sink is the only destination; if it cannot record, fail closed (nothing is ever sent).
  const { error: capErr } = await db.from("hair_system_test_notifications").upsert(captures, { onConflict: "stripe_checkout_session_id,test_order_id,channel", ignoreDuplicates: true });
  if (capErr) throw new Error(`test_sink_unavailable:${capErr.message}`);
  await db.from("hair_system_test_drafts").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", draft.id);
  return { paid: true, orderIds: o.map((r) => r.id), receipt };
}
