import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    const user = userData?.user;
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const payload = await req.json().catch(() => ({}));
    const action = payload?.action;

    if (action === "public-key") {
      const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      if (!publicKey) return json({ error: "Push is not configured" }, 500);
      return json({ publicKey });
    }

    if (action === "subscribe") {
      const sub = payload?.subscription;
      const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
      const p256dh = sub?.keys?.p256dh;
      const auth = sub?.keys?.auth;

      if (!endpoint.startsWith("https://") || typeof p256dh !== "string" || typeof auth !== "string") {
        return json({ error: "Invalid push subscription" }, 400);
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint,
            subscription: { endpoint, keys: { p256dh, auth } },
            user_agent: typeof payload?.userAgent === "string" ? payload.userAgent.slice(0, 500) : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" },
        );

      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "unsubscribe") {
      const endpoint = payload?.endpoint;
      if (typeof endpoint !== "string" || !endpoint) return json({ error: "Invalid endpoint" }, 400);
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
