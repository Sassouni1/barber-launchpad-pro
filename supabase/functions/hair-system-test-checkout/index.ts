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

    const testRef = async () => (await db.from("app_settings").select("value").eq("key", "hair_system_test_webhook_secret_ref").maybeSingle()).data?.value as any ?? null;
    if (body.action === "config") { const ref = await testRef(); return json({ configured: Boolean(key), webhookConfigured: webhookConfigured || Boolean(ref?.secret_id), webhookEndpoint: ref?.endpoint_id ?? null }); }

    if (body.action === "setup_test_webhook") {
      // Creates a TEST-mode endpoint only (test key is account-verified). Signing secret is stored encrypted, never returned or logged.
      if (!key) return json({ error: "No verified test key." }, 503);
      const existing = await testRef();
      if (existing?.endpoint_id) return json({ status: "already_configured", endpoint: existing.endpoint_id });
      const encKey = Deno.env.get("GHL_ENCRYPTION_KEY");
      if (!encKey) return json({ error: "Encryption key unavailable." }, 503);
      const target = `${url}/functions/v1/hair-system-test-webhook`;
      const form = new URLSearchParams({ url: target, "enabled_events[0]": "checkout.session.completed", "enabled_events[1]": "checkout.session.async_payment_succeeded", description: "Barber Launch hair-system TEST sink (captures only, no sends)", "metadata[hair_system_test_mode]": "true" });
      const r = await fetch("https://api.stripe.com/v1/webhook_endpoints", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `hair_test_whk_${user.id}` }, body: form });
      const ep = await r.json();
      if (!r.ok) return json({ error: "stripe_rejected", code: ep?.error?.code ?? null, type: ep?.error?.type ?? null, message: String(ep?.error?.message ?? "").slice(0, 200) }, 502);
      if (ep.livemode !== false || !String(ep.secret ?? "").startsWith("whsec_")) return json({ error: "unexpected_endpoint" }, 502);
      const { data: secretId, error: encErr } = await db.rpc("store_encrypted_token", { token_value: ep.secret, encryption_key: encKey });
      if (encErr || !secretId) return json({ error: "store_failed", endpoint: ep.id }, 500);
      await db.from("app_settings").upsert({ key: "hair_system_test_webhook_secret_ref", value: { endpoint_id: ep.id, secret_id: secretId, url: target, livemode: false, created_by: user.id, created_at: new Date().toISOString() } }, { onConflict: "key" });
      return json({ status: "created", endpoint: ep.id, url: target, livemode: false, events: ep.enabled_events });
    }

    if (body.action === "webhook_events") {
      const { data } = await db.from("hair_system_test_webhook_events").select("*").order("created_at", { ascending: false }).limit(20);
      return json({ events: data });
    }

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

    if (body.action === "expire_unused") {
      // Only this admin's own unpaid cs_test_ drafts; never touches paid sessions.
      const { data: drafts } = await db.from("hair_system_test_drafts").select("id, stripe_checkout_session_id, status")
        .eq("admin_user_id", user.id).neq("status", "paid").neq("status", "canceled").like("stripe_checkout_session_id", "cs_test_%").limit(50);
      const out: { session: string; result: string }[] = [];
      for (const d of drafts ?? []) {
        const sid = d.stripe_checkout_session_id as string;
        const h = { Authorization: `Bearer ${key}` };
        const s = await (await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}`, { headers: h })).json();
        if (s?.livemode !== false || s?.metadata?.admin_user_id !== user.id) { out.push({ session: sid, result: "skipped_unverified" }); continue; }
        if (s.payment_status === "paid" || s.status === "complete") { out.push({ session: sid, result: "skipped_paid" }); continue; }
        if (s.status === "open") {
          const ex = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}/expire`, { method: "POST", headers: h });
          if (!ex.ok) { out.push({ session: sid, result: "expire_failed" }); continue; }
        }
        await db.from("hair_system_test_drafts").update({ status: "canceled" }).eq("id", d.id).eq("admin_user_id", user.id).neq("status", "paid");
        out.push({ session: sid, result: "canceled" });
      }
      return json({ results: out, outbound_messages_sent: 0 });
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
    return json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("hair-system-test-checkout error", e instanceof Error ? e.message : "error");
    return json({ error: e instanceof Error ? e.message.slice(0, 200) : "Test checkout failed." }, 400);
  }
});
