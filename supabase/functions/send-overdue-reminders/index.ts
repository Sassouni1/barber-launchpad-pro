import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CUTOFF_DATE = "2026-03-30T00:00:00Z";
const APP_URL = "https://barber-launchpad-pro.lovable.app";

const REMINDER_MESSAGES = [
  (name: string) =>
    `Hey ${name}! You're making great progress. Don't forget to complete your current tasks — you're almost there! 💪`,
  (name: string) =>
    `Just a friendly reminder — your training tasks are waiting for you. Let's get back on track! Log in here: ${APP_URL}`,
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ghlApiKey = Deno.env.get("GHL_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    if (!ghlApiKey) {
      throw new Error("GHL_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get new users (created after cutoff) with phone numbers
    const { data: eligibleUsers, error: usersErr } = await supabase
      .from("profiles")
      .select("id, full_name, phone, created_at")
      .gt("created_at", CUTOFF_DATE)
      .not("phone", "is", null);

    if (usersErr) throw usersErr;
    if (!eligibleUsers || eligibleUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No eligible users found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get all dynamic todo lists with items
    const { data: lists, error: listsErr } = await supabase
      .from("dynamic_todo_lists")
      .select("id, title, order_index, due_days")
      .order("order_index");
    if (listsErr) throw listsErr;

    const { data: allItems, error: itemsErr } = await supabase
      .from("dynamic_todo_items")
      .select("id, list_id");
    if (itemsErr) throw itemsErr;

    // Build items per list
    const itemsByList: Record<string, string[]> = {};
    for (const item of allItems || []) {
      if (!itemsByList[item.list_id]) itemsByList[item.list_id] = [];
      itemsByList[item.list_id].push(item.id);
    }

    let sentCount = 0;

    for (const user of eligibleUsers) {
      if (!user.phone) continue;

      const accountCreated = new Date(user.created_at);
      const now = new Date();
      const daysSinceCreation = Math.floor(
        (now.getTime() - accountCreated.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 3. Get user's dynamic todo progress
      const { data: progress, error: progErr } = await supabase
        .from("user_dynamic_todo_progress")
        .select("item_id, completed")
        .eq("user_id", user.id);
      if (progErr) continue;

      const completedItemIds = new Set(
        (progress || []).filter((p) => p.completed).map((p) => p.item_id)
      );

      // 4. Find current (first incomplete) list and check if overdue
      let currentList: (typeof lists)[0] | null = null;
      let currentListCompletedCount = 0;

      for (const list of lists || []) {
        const listItemIds = itemsByList[list.id] || [];
        const completedInList = listItemIds.filter((id) =>
          completedItemIds.has(id)
        ).length;

        if (completedInList < listItemIds.length) {
          currentList = list;
          currentListCompletedCount = completedInList;
          break;
        }
      }

      if (!currentList) continue; // All lists completed
      if (!currentList.due_days) continue; // No due_days set
      if (daysSinceCreation <= currentList.due_days) continue; // Not overdue

      // 5. Check sms_reminders tracking
      const { data: reminderRows, error: remErr } = await supabase
        .from("sms_reminders")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (remErr) continue;

      let reminder = reminderRows;

      if (reminder) {
        // Check if progress was made since last reminder
        if (currentListCompletedCount > reminder.last_progress_snapshot) {
          // Progress made — reset counter
          await supabase
            .from("sms_reminders")
            .update({
              reminder_count: 0,
              last_progress_snapshot: currentListCompletedCount,
              last_list_id: currentList.id,
            })
            .eq("user_id", user.id);
          reminder.reminder_count = 0;
        }

        // If different list now, also reset
        if (reminder.last_list_id && reminder.last_list_id !== currentList.id) {
          await supabase
            .from("sms_reminders")
            .update({
              reminder_count: 0,
              last_progress_snapshot: currentListCompletedCount,
              last_list_id: currentList.id,
            })
            .eq("user_id", user.id);
          reminder.reminder_count = 0;
        }

        if (reminder.reminder_count >= 2) continue; // Max reached
      }

      // 6. Send SMS via GHL API v2
      const reminderIndex = reminder ? reminder.reminder_count : 0;
      const messageText = REMINDER_MESSAGES[reminderIndex](
        user.full_name || "there"
      );

      try {
        const ghlResponse = await fetch(
          "https://services.leadconnectorhq.com/conversations/messages",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ghlApiKey}`,
              "Content-Type": "application/json",
              Version: "2021-07-28",
            },
            body: JSON.stringify({
              type: "SMS",
              contactId: user.phone, // GHL uses phone as contact lookup
              message: messageText,
            }),
          }
        );

        if (!ghlResponse.ok) {
          const errBody = await ghlResponse.text();
          console.error(
            `GHL API error for user ${user.id} [${ghlResponse.status}]: ${errBody}`
          );
          continue;
        }
        await ghlResponse.text(); // consume body

        // 7. Update tracking
        if (reminder) {
          await supabase
            .from("sms_reminders")
            .update({
              reminder_count: reminderIndex + 1,
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
        console.log(
          `Sent reminder ${reminderIndex + 1} to user ${user.id} (${user.phone})`
        );
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
