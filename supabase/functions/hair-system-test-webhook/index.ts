// Stripe TEST-mode webhook for the isolated hair-system test checkout.
// Rejects livemode=true. Never sends messages; captures only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hairSystemTestStripeKey, processTestSession, verifyStripeSignature } from "../_shared/hairSystemTestMode.ts";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const whsec = Deno.env.get("HAIR_SYSTEM_STRIPE_TEST_WEBHOOK_SECRET") ?? "";
  const key = hairSystemTestStripeKey();
  if (!whsec.startsWith("whsec_") || !key) return json({ error: "Test mode not configured." }, 503);

  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get("stripe-signature") ?? "", whsec))) return json({ error: "Invalid signature." }, 400);
  const event = JSON.parse(payload);
  if (event.livemode !== false) return json({ error: "Live events are not accepted here." }, 400);
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return json({ received: true, ignored: event.type });
  const session = event.data?.object ?? {};
  if (session.metadata?.hair_system_test_mode !== "true") return json({ received: true, ignored: "not_hair_system_test" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { error: claimErr } = await db.from("hair_system_test_webhook_events").insert({ event_id: event.id, event_type: event.type, livemode: false });
  if (claimErr) {
    const { data: ex } = await db.from("hair_system_test_webhook_events").select("status").eq("event_id", event.id).maybeSingle();
    if (ex?.status === "done") return json({ received: true, duplicate: true });
    await db.from("hair_system_test_webhook_events").update({ status: "processing", error: null }).eq("event_id", event.id);
  }
  try {
    const r = await processTestSession(db, String(session.id), key);
    await db.from("hair_system_test_webhook_events").update({ status: r.paid ? "done" : "not_paid" }).eq("event_id", event.id);
    return json({ received: true, paid: r.paid });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 300) : "error";
    await db.from("hair_system_test_webhook_events").update({ status: "failed", error: msg }).eq("event_id", event.id);
    return json({ error: "processing_failed" }, 500);
  }
});
