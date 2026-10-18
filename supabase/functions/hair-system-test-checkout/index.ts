// Admin-only Stripe TEST-mode hair-system checkout. Never uses live keys,
// never writes production orders, never sends messages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isStripeCheckoutUrl, processTestSession, resolveHairSystemTestKey, testLineItems } from "../_shared/hairSystemTestMode.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const text = (v: unknown, n = 500) => String(v ?? "").trim().slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authz = req.headers.get("Authorization");
    if (!authz) return json({ error: "Sign in required." }, 401);
    const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authz } } });
    const { data: { user } } = await auth.auth.getUser();
    if (!user?.email) return json({ error: "Sign in required." }, 401);
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: role } = await db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Admins only." }, 403);

    const body = await req.json().catch(() => ({}));
    const key = await resolveHairSystemTestKey();
    const webhookConfigured = (Deno.env.get("HAIR_SYSTEM_STRIPE_TEST_WEBHOOK_SECRET") ?? "").startsWith("whsec_");

    if (body.action === "config") return json({ configured: Boolean(key), webhookConfigured });

    if (body.action === "results") {
      const { data: drafts } = await db.from("hair_system_test_drafts").select("id, stripe_checkout_session_id, status, paid_at, created_at, customer_name").order("created_at", { ascending: false }).limit(10);
      const ids = (drafts ?? []).map((d) => d.stripe_checkout_session_id).filter(Boolean);
      const [{ data: orders }, { data: notes }] = await Promise.all([
        db.from("hair_system_test_orders").select("*").in("stripe_checkout_session_id", ids.length ? ids : ["-"]),
        db.from("hair_system_test_notifications").select("*").in("stripe_checkout_session_id", ids.length ? ids : ["-"]),
      ]);
      return json({ drafts, orders, notifications: notes, outbound_messages_sent: 0 });
    }

    if (!key) return json({ error: "Test mode is not configured: no verified test key for the hair-system Stripe account." }, 503);

    if (body.action === "verify") {
      const r = await processTestSession(db, text(body.sessionId, 100), key, user.id);
      return json(r);
    }

    const required = ["barberFirstName", "barberLastName", "barberPhone", "address1", "city", "state", "zip"];
    if (required.some((f) => !text(body[f]))) return json({ error: "Complete every required field." }, 400);
    const shippingSpeed = text(body.shippingSpeed, 100);
    if (!["Shipping · $10", "Rush Ship (3 Days) · $50"].includes(shippingSpeed)) return json({ error: "Choose shipping." }, 400);
    const systems: Record<string, unknown>[] = Array.isArray(body.systems) ? body.systems.slice(0, 12) : [];
    if (!systems.length || systems.some((s) => !["color", "base", "length"].every((f) => text(s[f])))) return json({ error: "Complete each system." }, 400);

    const name = `${text(body.barberFirstName, 50)} ${text(body.barberLastName, 50)}`.trim();
    const email = user.email.toLowerCase();
    const base = { source: "barber-launch-TEST-MODE", order_type: "hair_system", test_mode: true, submitted_at: new Date().toISOString(), full_name: name, email, phone: text(body.barberPhone, 40),
      shipping: { method: shippingSpeed, address_1: text(body.address1, 150), address_2: text(body.address2, 150), city: text(body.city, 100), state: text(body.state, 2).toUpperCase(), zip: text(body.zip, 10) }, notes: text(body.notes, 2000) };
    const { data: draft, error } = await db.from("hair_system_test_drafts").insert({
      admin_user_id: user.id, customer_email: email, customer_name: name, base_details: base, shipping_speed: shippingSpeed,
      systems: systems.map((s) => ({ "Client Name": text(s.clientName, 100), "Choose Color": text(s.color, 100), "Lace or Skin": text(s.base, 50), "Hair Length": text(s.length === "Other" ? s.lengthOther : s.length, 50), "Choose Density": text(s.density === "Custom" ? s.densityOther : s.density, 100), "Curl Pattern": text(s.curl, 100) })),
    }).select("id").single();
    if (error || !draft) return json({ error: "Unable to prepare test draft." }, 500);

    const origin = new URL(req.headers.get("origin") || "https://member.thebarberlaunch.com").origin;
    const form = new URLSearchParams({ mode: "payment", ui_mode: "hosted", customer_email: email,
      success_url: `${origin}/admin/hair-system-test?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/admin/hair-system-test?canceled=1`,
      "metadata[hair_system_test_mode]": "true", "metadata[test_draft_id]": draft.id, "metadata[admin_user_id]": user.id,
      "phone_number_collection[enabled]": "false" });
    testLineItems(systems, shippingSpeed).forEach((li, i) => {
      form.append(`line_items[${i}][price_data][currency]`, "usd");
      form.append(`line_items[${i}][price_data][unit_amount]`, String(li.unit_amount));
      form.append(`line_items[${i}][price_data][product_data][name]`, li.name);
      form.append(`line_items[${i}][quantity]`, String(li.quantity));
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `hair_test_${draft.id}` }, body: form });
    const session = await res.json();
    if (!res.ok || session.livemode !== false || !String(session.id).startsWith("cs_test_")) return json({ error: "Unable to start test payment." }, 502);
    await db.from("hair_system_test_drafts").update({ stripe_checkout_session_id: session.id }).eq("id", draft.id);
    if (!isStripeCheckoutUrl(session.url)) return json({ error: "Unexpected checkout URL." }, 502);
    return json({ url: session.url });
  } catch (e) {
    console.error("hair-system-test-checkout error", e instanceof Error ? e.message : "error");
    return json({ error: e instanceof Error ? e.message.slice(0, 200) : "Test checkout failed." }, 400);
  }
});
