import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const text = (value: unknown, limit = 500) => String(value || "").trim().slice(0, limit);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) throw new Error("You must be signed in to submit an order.");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user?.email) throw new Error("You must be signed in to submit an order.");

    const body = await req.json();
    const required = ["barberName", "barberPhone", "address1", "city", "state", "zip"];
    if (required.some((field) => !text(body[field]))) throw new Error("Please complete every required order field.");
    if (!/^\d{5}(-\d{4})?$/.test(text(body.zip, 10))) throw new Error("Please provide a valid ZIP code.");

    const systems = Array.isArray(body.systems) && body.systems.length ? body.systems.slice(0, 12) : [body];
    if (systems.some((system) => !["clientName", "color", "length"].every((field) => text(system[field])))) throw new Error("Please complete each system's client, color, and length.");
    const baseDetails = {
      source: "barber-launch-native-order-form",
      order_type: "hair_system",
      submitted_at: new Date().toISOString(),
      full_name: text(body.barberName, 100), phone: text(body.barberPhone, 40),
      shipping: { method: text(body.shippingSpeed, 100), address_1: text(body.address1, 150), address_2: text(body.address2, 150), city: text(body.city, 100), state: text(body.state, 2).toUpperCase(), zip: text(body.zip, 10) },
      notes: text(body.notes, 2000),
    };

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ordersToInsert = systems.map((system, index) => ({ user_id: user.id, customer_email: user.email.toLowerCase(), customer_name: text(body.barberName, 100), status: "pending", order_details: { ...baseDetails, order_number: index + 1, total_orders: systems.length, "Client Name": text(system.clientName, 100), "Choose Color": text(system.color, 100), "Hair Length": text(system.length, 50), "Choose Density if Needed (75%-110%) - 100% is regular": text(system.density, 100), "Curl Pattern — only if needed": text(system.curl, 100), quantity: 1, line_items: [{ title: "Hair System", quantity: 1 }] } }));
    const { data: order, error } = await serviceClient.from("orders").insert(ordersToInsert).select("id");
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, order_ids: order.map((item) => item.id) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to submit order." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
