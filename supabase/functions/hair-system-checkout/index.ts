import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const text = (value: unknown, limit = 500) => String(value || "").trim().slice(0, limit);
// Live Invasion Digital Media catalog (acct_1LMNKMI6LFtj88Bq).
const priceIds = {
  standard: "price_1UHZUmI6LFtj88BqFeN5RXMM", // Standard Men's System (5 inch) $200
  curly: "price_1UHZW8I6LFtj88BqptT2JZbo", // Curly Pattern Add-On $30
  wave: "price_1UHZWdI6LFtj88BqoJ0qhYgd", // Wave Unit Add-On $50
  custom14: "price_1UHZVDI6LFtj88BqUbLWo2UX", // Custom 14-inch System $262.50
  custom16: "price_1UHZVfI6LFtj88Bq2nei9tKN", // Custom 16-inch System $315
  rush: "price_1UHZWyI6LFtj88Bq3p9kFEK1", // Rush Shipping $50
} as const;

function lineItems(systems: Record<string, unknown>[], shippingSpeed: string) {
  const quantities = new Map<string, number>();
  const add = (price: string) => quantities.set(price, (quantities.get(price) || 0) + 1);
  for (const system of systems) {
    const customLength = text(system.lengthOther);
    add(
      system.length === "Other" && customLength === '14" hair'
        ? priceIds.custom14
        : system.length === "Other" && customLength === '16" hair'
          ? priceIds.custom16
          : priceIds.standard,
    );
    const curl = text(system.curl);
    if (curl === "Wave unit") add(priceIds.wave);
    else if (curl && curl !== "Standard") add(priceIds.curly);
  }
  if (shippingSpeed.startsWith("Rush")) add(priceIds.rush);
  const pairs = [...quantities.entries()].map(([price, quantity], index) => [
    `line_items[${index}][price]`, price,
    `line_items[${index}][quantity]`, String(quantity),
  ]).flat();

  if (shippingSpeed === "Shipping · $10") {
    const index = quantities.size;
    pairs.push(
      `line_items[${index}][price_data][currency]`, "usd",
      `line_items[${index}][price_data][unit_amount]`, "1000",
      `line_items[${index}][price_data][product_data][name]`, "Shipping",
      `line_items[${index}][quantity]`, "1",
    );
  }
  return pairs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) throw new Error("You must be signed in to checkout.");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const auth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user?.email) throw new Error("You must be signed in to checkout.");

    const body = await req.json();
    // Invasion Digital Media live account (acct_1LMNKMI6LFtj88Bq).
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) throw new Error("Hair system payments are not configured.");
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (body.action === "verify") {
      const sessionId = text(body.sessionId, 100);
      if (!sessionId.startsWith("cs_")) throw new Error("Invalid checkout session.");
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${secret}` } });
      const session = await response.json();
      if (!response.ok || session.metadata?.user_id !== user.id) throw new Error("Unable to verify this checkout.");
      if (session.payment_status !== "paid") return new Response(JSON.stringify({ paid: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const orderIds = text(session.metadata?.order_ids, 500).split(",").filter(Boolean);
      if (orderIds.length) {
        // Idempotent: only lifts orders out of pending_payment, so a repeat
        // return-URL visit (or the webhook arriving first) changes nothing.
        // Customer/supplier notifications are NEVER sent from this path — the
        // signed hair-system-stripe-webhook owns all messaging.
        const { error } = await admin
          .from("orders")
          .update({ status: "pending" })
          .in("id", orderIds)
          .eq("status", "pending_payment");
        if (error) throw error;
      }
      if (session.metadata?.save_card === "true" && typeof session.customer === "string" && typeof session.payment_intent === "string") {
        const intentResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(session.payment_intent)}`, { headers: { Authorization: `Bearer ${secret}` } });
        const intent = await intentResponse.json();
        if (intentResponse.ok && typeof intent.payment_method === "string") {
          const customerForm = new URLSearchParams({ "invoice_settings[default_payment_method]": intent.payment_method });
          const customerResponse = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(session.customer)}`, { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body: customerForm });
          if (!customerResponse.ok) throw new Error("Unable to save this payment method.");
          const { error } = await admin.from("member_billing_profiles").upsert({ customer_id: user.id, stripe_customer_id: session.customer, default_payment_method_id: intent.payment_method }, { onConflict: "customer_id" });
          if (error) throw error;
        }
      }
      return new Response(JSON.stringify({ paid: true, order_ids: orderIds }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const required = ["barberFirstName", "barberLastName", "barberPhone", "address1", "city", "state", "zip"];
    if (required.some((field) => !text(body[field]))) throw new Error("Please complete every required order field.");
    const shippingSpeed = text(body.shippingSpeed, 100);
    if (!["Shipping · $10", "Rush Ship (3 Days) · $50"].includes(shippingSpeed)) {
      throw new Error("Please choose a shipping preference.");
    }
    if (!/^\d{5}(-\d{4})?$/.test(text(body.zip, 10))) throw new Error("Please provide a valid ZIP code.");
    const systems: Record<string, unknown>[] = Array.isArray(body.systems) && body.systems.length ? body.systems.slice(0, 12) : [body];
    if (systems.some((system) => !["color", "base", "length"].every((field) => text(system[field])))) throw new Error("Please complete each system's color, base, and length.");

    const customerEmail = user.email.toLowerCase();
    const buyerName = `${text(body.barberFirstName, 50)} ${text(body.barberLastName, 50)}`.trim();
    const baseDetails = {
      source: "barber-launch-native-order-form", order_type: "hair_system", submitted_at: new Date().toISOString(),
      full_name: buyerName, email: customerEmail, phone: text(body.barberPhone, 40),
      shipping: { method: shippingSpeed, address_1: text(body.address1, 150), address_2: text(body.address2, 150), city: text(body.city, 100), state: text(body.state, 2).toUpperCase(), zip: text(body.zip, 10) }, notes: text(body.notes, 2000),
    };
    const { data: orders, error: insertError } = await admin.from("orders").insert(systems.map((system, index) => ({
      user_id: user.id, customer_email: customerEmail, customer_name: buyerName, status: "pending_payment",
      order_details: { ...baseDetails, order_number: index + 1, total_orders: systems.length, "Client Name": text(system.clientName, 100), "Choose Color": text(system.color, 100), "Lace or Skin": text(system.base, 50), "Hair Length": text(system.length === "Other" ? system.lengthOther : system.length, 50), "Choose Density": text(system.density === "Custom" ? system.densityOther : system.density, 100), "Curl Pattern": text(system.curl, 100) },
    }))).select("id");
    if (insertError || !orders?.length) throw insertError || new Error("Unable to prepare the order.");

    let { data: billing, error: billingError } = await admin
      .from("member_billing_profiles")
      .select("stripe_customer_id")
      .eq("customer_id", user.id)
      .maybeSingle();
    if (billingError) throw billingError;
    if (!billing) {
      const { data, error } = await admin
        .from("member_billing_profiles")
        .insert({ customer_id: user.id })
        .select("stripe_customer_id")
        .single();
      if (error) throw error;
      billing = data;
    }
    let stripeCustomerId = billing.stripe_customer_id as string | null;
    if (!stripeCustomerId) {
      const customerForm = new URLSearchParams({
        email: customerEmail,
        name: buyerName,
        "metadata[barber_launch_member_id]": user.id,
      });
      const customerResponse = await fetch("https://api.stripe.com/v1/customers", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body: customerForm });
      const customer = await customerResponse.json();
      if (!customerResponse.ok || !customer.id) throw new Error("Unable to prepare your secure payment profile.");
      stripeCustomerId = customer.id;
      const { error } = await admin.from("member_billing_profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("customer_id", user.id);
      if (error) throw error;
    }
    if (!stripeCustomerId) throw new Error("Unable to prepare your secure payment profile.");

    const origin = new URL(req.headers.get("origin") || "https://member.thebarberlaunch.com").origin;
    const saveCard = body.saveCardForFutureOrders === true;
    // Customer receipts are sent only by the signature-verified webhook after
    // payment. Omitting receipt_email prevents an extra Stripe-native receipt.
    const form = new URLSearchParams({ mode: "payment", ui_mode: "embedded", customer: stripeCustomerId, return_url: `${origin}/order-hair-system?checkout=success&session_id={CHECKOUT_SESSION_ID}`, "metadata[user_id]": user.id, "metadata[order_ids]": orders.map((order) => order.id).join(","), "metadata[save_card]": String(saveCard), "payment_intent_data[metadata][user_id]": user.id, "payment_intent_data[metadata][order_ids]": orders.map((order) => order.id).join(","), "payment_intent_data[metadata][save_card]": String(saveCard) });
    if (saveCard) form.append("payment_intent_data[setup_future_usage]", "off_session");
    const pairs = lineItems(systems, shippingSpeed);
    for (let index = 0; index < pairs.length; index += 2) form.append(pairs[index], pairs[index + 1]);
    const checkoutResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `hair_checkout_${orders.map((order) => order.id).join("_")}` }, body: form });
    const session = await checkoutResponse.json();
    if (!checkoutResponse.ok || !session.client_secret) throw new Error("Unable to start secure payment.");
    return new Response(JSON.stringify({ clientSecret: session.client_secret }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to start checkout." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
