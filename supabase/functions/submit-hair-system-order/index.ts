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
    const required = ["barberName", "barberPhone", "clientName", "color", "length", "address1", "city", "state", "zip"];
    if (required.some((field) => !text(body[field]))) throw new Error("Please complete every required order field.");
    if (!/^\d{5}(-\d{4})?$/.test(text(body.zip, 10))) throw new Error("Please provide a valid ZIP code.");

    const quantity = Math.max(1, Math.min(99, Number.parseInt(text(body.quantity, 2), 10) || 1));
    const details = {
      source: "barber-launch-native-order-form",
      order_type: "hair_system",
      submitted_at: new Date().toISOString(),
      full_name: text(body.barberName, 100), phone: text(body.barberPhone, 40),
      "Client Name": text(body.clientName, 100),
      "Choose Color": text(body.color, 100), "Hair Length": text(body.length, 50),
      "Choose Density if Needed (75%-110%) - 100% is regular": text(body.density, 100),
      "Curl Pattern — only if needed": text(body.curl, 100), Parting: text(body.parting, 100), quantity,
      line_items: [{ title: "Hair System", quantity }],
      shipping: { method: text(body.shippingSpeed, 100), address_1: text(body.address1, 150), address_2: text(body.address2, 150), city: text(body.city, 100), state: text(body.state, 2).toUpperCase(), zip: text(body.zip, 10) },
      notes: text(body.notes, 2000),
    };

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order, error } = await serviceClient.from("orders").insert({
      user_id: user.id, customer_email: user.email.toLowerCase(), customer_name: text(body.barberName, 100), order_details: details, status: "pending",
    }).select("id").single();
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, order_id: order.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to submit order." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
