import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const caller = userData?.user;
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const payload = await req.json().catch(() => ({}));
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    const rawUrl = typeof payload?.url === "string" ? payload.url.trim() : "/";
    const recipientUserId =
      typeof payload?.recipient_user_id === "string" && payload.recipient_user_id
        ? payload.recipient_user_id
        : null;

    if (!title || title.length > 120) return json({ error: "Title is required (max 120 chars)" }, 400);
    if (!body || body.length > 500) return json({ error: "Message is required (max 500 chars)" }, 400);
    const url = rawUrl.startsWith("/") && !rawUrl.startsWith("//") ? rawUrl : "/";

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    if (!vapidPublic || !vapidPrivate || !vapidSubject) {
      return json({ error: "Push is not configured" }, 500);
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    let query = supabase.from("push_subscriptions").select("id, endpoint, subscription");
    if (recipientUserId) query = query.eq("user_id", recipientUserId);
    const { data: subs, error: subsError } = await query;
    if (subsError) return json({ error: subsError.message }, 400);

    const notification = JSON.stringify({ title, body, url });
    let delivered = 0;
    let failed = 0;
    const staleIds: string[] = [];

    for (const row of subs ?? []) {
      try {
        await webpush.sendNotification(row.subscription as never, notification);
        delivered++;
      } catch (err) {
        failed++;
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) staleIds.push(row.id as string);
      }
    }

    if (staleIds.length) {
      await supabase.from("push_subscriptions").delete().in("id", staleIds);
    }

    await supabase.from("push_notification_deliveries").insert({
      created_by: caller.id,
      title,
      body,
      target_url: url,
      recipient_user_id: recipientUserId,
      attempted_count: subs?.length ?? 0,
      delivered_count: delivered,
      failed_count: failed,
    });

    return json({
      success: true,
      attempted: subs?.length ?? 0,
      delivered,
      failed,
      removed_stale: staleIds.length,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
