import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const text = (value: unknown, limit = 500) => String(value || "").trim().slice(0, limit);
const priceIds = {
  standard: "price_1UHRgOAlgWpO5KsvxJMjlA80",
  curly: "price_1UHRgoAlgWpO5Ksvi1uDkJAZ",
  wave: "price_1UHRgoAlgWpO5KsvvP6NAqgL",
  custom14: "price_1UHRgpAlgWpO5KsvK4EfnLHS",
  custom16: "price_1UHRgpAlgWpO5KsvZLotPy89",
  rush: "price_1UHRgqAlgWpO5KsvIUgnAjq0",
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
  return [...quantities.entries()].map(([price, quantity], index) => [`line_items[${index}][price]`, price, `line_items[${index}][quantity]`, String(quantity)]).flat();
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
    const secret = Deno.env.get("HAIR_SYSTEM_STRIPE_SECRET_KEY");
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
        const { error } = await admin.from("orders").update({ status: "pending" }).in("id", orderIds);
        if (error) throw error;
      }
      return new Response(JSON.stringify({ paid: true, order_ids: orderIds }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const required = ["barberFirstName", "barberLastName", "barberPhone", "address1", "city", "state", "zip"];
    if (required.some((field) => !text(body[field]))) throw new Error("Please complete every required order field.");
    if (!/^\d{5}(-\d{4})?$/.test(text(body.zip, 10))) throw new Error("Please provide a valid ZIP code.");
    const systems = Array.isArray(body.systems) && body.systems.length ? body.systems.slice(0, 12) : [body];
    if (systems.some((system) => !["color", "length"].every((field) => text(system[field])))) throw new Error("Please complete each system's color and length.");

    const buyerName = `${text(body.barberFirstName, 50)} ${text(body.barberLastName, 50)}`.trim();
    const baseDetails = {
      source: "barber-launch-native-order-form", order_type: "hair_system", submitted_at: new Date().toISOString(),
      full_name: buyerName, email: user.email.toLowerCase(), phone: text(body.barberPhone, 40),
      shipping: { method: text(body.shippingSpeed, 100), address_1: text(body.address1, 150), address_2: text(body.address2, 150), city: text(body.city, 100), state: text(body.state, 2).toUpperCase(), zip: text(body.zip, 10) }, notes: text(body.notes, 2000),
    };
    const { data: orders, error: insertError } = await admin.from("orders").insert(systems.map((system, index) => ({
      user_id: user.id, customer_email: user.email.toLowerCase(), customer_name: buyerName, status: "pending_payment",
      order_details: { ...baseDetails, order_number: index + 1, total_orders: systems.length, "Client Name": text(system.clientName, 100), "Choose Color": text(system.color, 100), "Hair Length": text(system.length === "Other" ? system.lengthOther : system.length, 50), "Choose Density": text(system.density === "Custom" ? system.densityOther : system.density, 100), "Curl Pattern": text(system.curl, 100) },
    }))).select("id");
    if (insertError || !orders?.length) throw insertError || new Error("Unable to prepare the order.");

    const origin = new URL(req.headers.get("origin") || "https://member.thebarberlaunch.com").origin;
    const form = new URLSearchParams({ mode: "payment", customer_email: user.email.toLowerCase(), success_url: `${origin}/order-hair-system?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/order-hair-system?checkout=cancelled`, "metadata[user_id]": user.id, "metadata[order_ids]": orders.map((order) => order.id).join(","), "payment_intent_data[metadata][user_id]": user.id, "payment_intent_data[metadata][order_ids]": orders.map((order) => order.id).join(",") });
    const pairs = lineItems(systems, text(body.shippingSpeed));
    for (let index = 0; index < pairs.length; index += 2) form.append(pairs[index], pairs[index + 1]);
    const checkoutResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `hair_checkout_${orders.map((order) => order.id).join("_")}` }, body: form });
    const session = await checkoutResponse.json();
    if (!checkoutResponse.ok || !session.url) throw new Error("Unable to start secure checkout.");
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to start checkout." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
