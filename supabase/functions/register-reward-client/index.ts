import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, client_name, client_phone, client_email } = await req.json();

    // Validate required fields
    if (!user_id || typeof user_id !== "string") {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = (client_name || "").trim();
    if (!name || name.length > 200) {
      return new Response(
        JSON.stringify({ error: "Name is required and must be under 200 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phone = (client_phone || "").trim() || null;
    const email = (client_email || "").trim() || null;

    if (phone && phone.length > 50) {
      return new Response(JSON.stringify({ error: "Phone must be under 50 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (email && email.length > 255) {
      return new Response(JSON.stringify({ error: "Email must be under 255 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Duplicate detection: same name + phone for same user
    let query = supabase
      .from("reward_clients")
      .select("id")
      .eq("user_id", user_id)
      .eq("client_name", name);

    if (phone) {
      query = query.eq("client_phone", phone);
    } else {
      query = query.is("client_phone", null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, already_registered: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error } = await supabase.from("reward_clients").insert({
      user_id,
      client_name: name,
      client_phone: phone,
      client_email: email,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, already_registered: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
