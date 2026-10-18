import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { hairSystemStripeKey, loadExpandedSession, stripeGet } from "../_shared/hairSystemFulfillment.ts";
import { HAIR_SYSTEM_SELLER_ACCOUNT } from "../_shared/hairSystemFulfillmentLogic.ts";
import { receiptAccessAllowed, stripeReceiptSnapshot, verifyReceiptOrder } from "../_shared/hairSystemReceipt.ts";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("receipt"), order_id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("search"), email: z.string().trim().email().max(254), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date") }).strict(),
]);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Deliberately read-only: no materialization, reconciliation, claims or sends.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Order details are unavailable." }, 503);
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: identity, error: authError } = await db.auth.getUser(token);
    if (authError || !identity.user) return json({ error: "Please sign in." }, 401);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Provide a valid order ID, or buyer email and date." }, 400);
    const { data: role, error: roleError } = await db.rpc("has_role", { _user_id: identity.user.id, _role: "admin" });
    const admin = !roleError && role === true;
    if (parsed.data.action === "search") {
      if (!admin) return json({ error: "Admins only." }, 403);
      // UTC calendar day. Exact email filter prevents a broad member-data search.
      const start = new Date(`${parsed.data.date}T00:00:00Z`);
      const end = new Date(start.getTime() + 86400000);
      const { data: orders, error } = await db.from("orders")
        .select("id, customer_name, customer_email, order_date, status, order_details, stripe_checkout_session_id")
        .eq("customer_email", parsed.data.email.toLowerCase()).gte("order_date", start.toISOString()).lt("order_date", end.toISOString())
        .neq("status", "pending_payment").order("order_date").limit(50);
      if (error) return json({ error: "Stored order details could not be read." }, 503);
      const ids = (orders ?? []).map((o) => o.id);
      const { data: attempts, error: attemptError } = ids.length
        ? await db.from("order_notifications").select("order_id, channel, status, attempts, reason, updated_at, provider_message_id").in("order_id", ids).eq("channel", "supplier_email")
        : { data: [], error: null };
      return json({ orders: (orders ?? []).map((o) => ({ ...o, supplier_delivery: attemptError ? null : (attempts ?? []).find((a) => a.order_id === o.id) ?? { status: "not_attempted", attempts: 0 }, supplier_error: attemptError ? "Supplier attempt status unavailable." : null })) });
    }
    const { data: order, error } = await db.from("orders").select("*").eq("id", parsed.data.order_id).maybeSingle();
    if (error) return json({ error: "Order details are unavailable." }, 503);
    if (!order || !receiptAccessAllowed(identity.user.id, admin, order.user_id)) return json({ error: "Order not found." }, 404);
    if (order.status === "pending_payment") return json({ error: "Payment is not confirmed." }, 409);
    const sessionId = order.stripe_checkout_session_id;
    if (!sessionId || !/^cs_live_[A-Za-z0-9]+$/.test(sessionId)) return json({ error: "No native paid checkout is available for this order." }, 409);
    const key = hairSystemStripeKey();
    if (!key) return json({ error: "Stripe receipt lookup is unavailable." }, 503);
    const account = await stripeGet("/account", key);
    if (account.id !== HAIR_SYSTEM_SELLER_ACCOUNT) return json({ error: "Stripe seller verification failed." }, 503);
    const session = await loadExpandedSession(sessionId, key);
    if (session.livemode !== true) return json({ error: "Live payment verification failed." }, 409);
    verifyReceiptOrder(order, session);
    const receipt = stripeReceiptSnapshot(session);
    const { data: siblings, error: siblingError } = await db.from("orders")
      .select("id, customer_name, customer_email, order_date, status, order_details, user_id, checkout_draft_id, system_index, payment_reference, stripe_checkout_session_id")
      .eq("stripe_checkout_session_id", sessionId).eq("user_id", order.user_id).neq("status", "pending_payment").order("system_index");
    if (siblingError || !siblings?.length) return json({ error: "Checkout order details are unavailable." }, 503);
    for (const sibling of siblings) verifyReceiptOrder(sibling, session);
    return json({ receipt, orders: siblings.map(({ user_id, checkout_draft_id, payment_reference, system_index, ...safe }) => safe) });
  } catch {
    return json({ error: "Paid amount unavailable — Stripe verification could not be completed. Please retry." }, 503);
  }
});