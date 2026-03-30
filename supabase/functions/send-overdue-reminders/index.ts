import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CUTOFF_DATE = "2026-03-30T00:00:00Z";
const APP_URL = "https://barber-launchpad-pro.lovable.app";
const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";

const REMINDER_MESSAGES = [
  (name: string) =>
    `Hey ${name}! You're making great progress. Don't forget to complete your current tasks — you're almost there! 💪`,
  (name: string) =>
    `Just a friendly reminder — your training tasks are waiting for you. Let's get back on track! Log in here: ${APP_URL}`,
];

const GHL_HEADERS = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  Version: "2021-07-28",
});

// ── OAuth token helper ──────────────────────────────────────

async function getAccessToken(supabase: any): Promise<{ accessToken: string; locationId: string } | null> {
  const encryptionKey = Deno.env.get("GHL_ENCRYPTION_KEY");
  if (!encryptionKey) {
    console.error("GHL_ENCRYPTION_KEY not set");
    return null;
  }

  const { data: tokenRecord, error } = await supabase
    .from("ghl_oauth_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !tokenRecord) {
    console.error("No GHL OAuth connection found");
    return null;
  }

  const now = new Date();
  const expiresAt = new Date(tokenRecord.expires_at);

  // If expired or within 5 min of expiry, refresh
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    try {
      const accessToken = await refreshToken(supabase, tokenRecord, encryptionKey);
      return { accessToken, locationId: tokenRecord.location_id };
    } catch (err) {
      console.error("Failed to refresh GHL token:", err);
      return null;
    }
  }

  // Decrypt current access token
  const { data: accessToken, error: decErr } = await supabase.rpc("decrypt_token", {
    token_id: tokenRecord.access_token_id,
    encryption_key: encryptionKey,
  });

  if (decErr || !accessToken) {
    console.error("Failed to decrypt access token:", decErr);
    return null;
  }

  return { accessToken, locationId: tokenRecord.location_id };
}

async function refreshToken(supabase: any, tokenRecord: any, encryptionKey: string): Promise<string> {
  const clientId = Deno.env.get("GHL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GHL_CLIENT_SECRET")!;

  const { data: currentRefreshToken } = await supabase.rpc("decrypt_token", {
    token_id: tokenRecord.refresh_token_id,
    encryption_key: encryptionKey,
  });

  const tokenRes = await fetch(GHL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: currentRefreshToken,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Refresh failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }

  const tokenData = await tokenRes.json();

  // Delete old secrets, store new ones
  await supabase.from("app_secrets").delete().eq("id", tokenRecord.access_token_id);
  await supabase.from("app_secrets").delete().eq("id", tokenRecord.refresh_token_id);

  const { data: newAccessId } = await supabase.rpc("store_encrypted_token", {
    token_value: tokenData.access_token,
    encryption_key: encryptionKey,
  });
  const { data: newRefreshId } = await supabase.rpc("store_encrypted_token", {
    token_value: tokenData.refresh_token,
    encryption_key: encryptionKey,
  });

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 86400) * 1000).toISOString();

  await supabase
    .from("ghl_oauth_tokens")
    .update({
      access_token_id: newAccessId,
      refresh_token_id: newRefreshId,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenRecord.id);

  return tokenData.access_token;
}

// ── GHL contact resolution ──────────────────────────────────

async function resolveGhlContactId(
  ghlApiKey: string,
  locationId: string,
  user: { full_name: string | null; phone: string | null; email: string | null }
): Promise<string | null> {
  if (user.email) {
    const res = await fetch(
      `${GHL_BASE}/contacts/search/duplicate?locationId=${locationId}&email=${encodeURIComponent(user.email)}`,
      { headers: GHL_HEADERS(ghlApiKey) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.contact?.id) return data.contact.id;
    }
  }

  const nameParts = (user.full_name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "Member";
  const lastName = nameParts.slice(1).join(" ") || "";

  const createRes = await fetch(`${GHL_BASE}/contacts/`, {
    method: "POST",
    headers: GHL_HEADERS(ghlApiKey),
    body: JSON.stringify({
      locationId,
      firstName,
      lastName,
      phone: user.phone,
      email: user.email,
    }),
  });

  if (createRes.ok) {
    const created = await createRes.json();
    return created.contact?.id || null;
  }

  console.error(`Failed to create GHL contact: ${createRes.status} ${await createRes.text()}`);
  return null;
}

// ── Main handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get OAuth token
    const credentials = await getAccessToken(supabase);
    if (!credentials) {
      return new Response(
        JSON.stringify({ error: "GHL not connected. Please connect via Admin Dashboard." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { accessToken: ghlApiKey, locationId: ghlLocationId } = credentials;

    // Get eligible users
    const { data: eligibleUsers, error: usersErr } = await supabase
      .from("profiles")
      .select("id, full_name, phone, email, created_at")
      .gt("created_at", CUTOFF_DATE)
      .not("phone", "is", null);

    if (usersErr) throw usersErr;
    if (!eligibleUsers?.length) {
      return new Response(
        JSON.stringify({ message: "No eligible users found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get todo lists and items
    const { data: lists, error: listsErr } = await supabase
      .from("dynamic_todo_lists")
      .select("id, title, order_index, due_days")
      .order("order_index");
    if (listsErr) throw listsErr;

    const { data: allItems, error: itemsErr } = await supabase
      .from("dynamic_todo_items")
      .select("id, list_id");
    if (itemsErr) throw itemsErr;

    const itemsByList: Record<string, string[]> = {};
    for (const item of allItems || []) {
      if (!itemsByList[item.list_id]) itemsByList[item.list_id] = [];
      itemsByList[item.list_id].push(item.id);
    }

    let sentCount = 0;

    for (const user of eligibleUsers) {
      if (!user.phone) continue;

      const daysSinceCreation = Math.floor(
        (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      const { data: progress } = await supabase
        .from("user_dynamic_todo_progress")
        .select("item_id, completed")
        .eq("user_id", user.id);

      const completedItemIds = new Set(
        (progress || []).filter((p) => p.completed).map((p) => p.item_id)
      );

      let currentList: (typeof lists)[0] | null = null;
      let currentListCompletedCount = 0;

      for (const list of lists || []) {
        const listItemIds = itemsByList[list.id] || [];
        const completedInList = listItemIds.filter((id) => completedItemIds.has(id)).length;
        if (completedInList < listItemIds.length) {
          currentList = list;
          currentListCompletedCount = completedInList;
          break;
        }
      }

      if (!currentList || !currentList.due_days || daysSinceCreation <= currentList.due_days) continue;

      const { data: reminder } = await supabase
        .from("sms_reminders")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      let reminderCount = reminder?.reminder_count ?? 0;

      if (reminder) {
        if (currentListCompletedCount > reminder.last_progress_snapshot ||
            (reminder.last_list_id && reminder.last_list_id !== currentList.id)) {
          await supabase
            .from("sms_reminders")
            .update({
              reminder_count: 0,
              last_progress_snapshot: currentListCompletedCount,
              last_list_id: currentList.id,
            })
            .eq("user_id", user.id);
          reminderCount = 0;
        }
        if (reminderCount >= 2) continue;
      }

      const contactId = await resolveGhlContactId(ghlApiKey, ghlLocationId, {
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
      });
      if (!contactId) continue;

      const messageText = REMINDER_MESSAGES[reminderCount](user.full_name || "there");

      try {
        const ghlResponse = await fetch(`${GHL_BASE}/conversations/messages`, {
          method: "POST",
          headers: GHL_HEADERS(ghlApiKey),
          body: JSON.stringify({
            type: "SMS",
            contactId,
            message: messageText,
            phone: user.phone,
          }),
        });

        if (!ghlResponse.ok) {
          console.error(`GHL API error for user ${user.id}: ${ghlResponse.status} ${await ghlResponse.text()}`);
          continue;
        }
        await ghlResponse.text();

        if (reminder) {
          await supabase
            .from("sms_reminders")
            .update({
              reminder_count: reminderCount + 1,
              last_sent_at: new Date().toISOString(),
              last_list_id: currentList.id,
              last_progress_snapshot: currentListCompletedCount,
            })
            .eq("user_id", user.id);
        } else {
          await supabase.from("sms_reminders").insert({
            user_id: user.id,
            reminder_count: 1,
            last_sent_at: new Date().toISOString(),
            last_list_id: currentList.id,
            last_progress_snapshot: currentListCompletedCount,
          });
        }

        sentCount++;
        console.log(`Sent reminder ${reminderCount + 1} to user ${user.id} (${user.phone})`);
      } catch (smsErr) {
        console.error(`Failed to send SMS to user ${user.id}:`, smsErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-overdue-reminders error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
