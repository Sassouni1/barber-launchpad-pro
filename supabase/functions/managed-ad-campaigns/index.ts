import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIN_DAILY_BUDGET_CENTS = 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function budgetToCents(value: unknown) {
  const dollars = Number(value);
  if (!Number.isFinite(dollars)) throw new Error("Invalid daily budget");
  const cents = Math.round(dollars * 100);
  if (cents < MIN_DAILY_BUDGET_CENTS) throw new Error("Daily budget must be at least $10.");
  return cents;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.slice("Bearer ".length);
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const action = body?.action as string | undefined;

    const getCampaign = async (campaignId: unknown) => {
      if (!isUuid(campaignId)) throw new Error("Invalid campaign");
      const { data, error } = await admin
        .from("ad_campaigns")
        .select("*")
        .eq("id", campaignId)
        .eq("customer_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Campaign not found");
      return data;
    };

    const addEvent = async (campaignId: string, eventType: string, detail: Record<string, unknown> = {}) => {
      const { error } = await admin.from("ad_campaign_events").insert({
        campaign_id: campaignId,
        customer_id: userId,
        event_type: eventType,
        detail,
        actor_id: userId,
      });
      if (error) throw error;
    };

    const queueMetaAction = async (campaign: any, jobAction: string, payload: Record<string, unknown>) => {
      const { data, error } = await admin.from("ad_meta_action_jobs").insert({
        campaign_id: campaign.id,
        customer_id: userId,
        action: jobAction,
        payload,
        idempotency_key: crypto.randomUUID(),
      }).select("id, status").single();
      if (error) throw error;
      return data;
    };

    if (action === "getDashboard") {
      const [{ data: campaigns, error: campaignsError }, { data: billing, error: billingError }, { data: transactions, error: transactionsError }] = await Promise.all([
        admin.from("ad_campaigns")
          .select("id,name,status,desired_status,daily_budget_cents,funded_cents,spent_cents,currency,meta_campaign_id,last_meta_status,created_at")
          .eq("customer_id", userId)
          .eq("member_visible", true)
          .order("created_at", { ascending: false }),
        admin.from("ad_billing_profiles")
          .select("autopay_enabled,recharge_amount_cents,recharge_threshold_cents,currency")
          .eq("customer_id", userId)
          .maybeSingle(),
        admin.from("ad_payment_transactions")
          .select("id,amount_cents,currency,status,purpose,created_at,completed_at")
          .eq("customer_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (campaignsError || billingError || transactionsError) throw campaignsError || billingError || transactionsError;
      return json({ campaigns: campaigns ?? [], billing: billing ?? null, transactions: transactions ?? [] });
    }

    if (action === "createCampaign") {
      const creationKey = body?.creationKey;
      if (!isUuid(creationKey)) return json({ error: "A valid idempotency key is required." }, 400);
      const dailyBudgetCents = budgetToCents(body?.dailyBudget);

      const { data: existing, error: existingError } = await admin
        .from("ad_campaigns")
        .select("id,status,daily_budget_cents")
        .eq("customer_id", userId)
        .eq("creation_key", creationKey)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ campaign: existing, idempotent: true });

      const { data: template, error: templateError } = await admin
        .from("ad_campaign_templates")
        .select("id,name,objective,landing_page_url")
        .eq("active", true)
        .eq("is_default", true)
        .maybeSingle();
      if (templateError) throw templateError;
      if (!template) return json({ error: "No active Barber Launch campaign template is configured." }, 409);

      const { data: account, error: accountError } = await admin
        .from("meta_ad_accounts")
        .select("meta_ad_account_id")
        .eq("active", true)
        .eq("account_mode", "managed")
        .limit(1)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account) return json({ error: "No active managed Meta account is configured." }, 409);

      const { data: campaign, error: campaignError } = await admin.from("ad_campaigns").insert({
        customer_id: userId,
        requested_by: userId,
        creation_key: creationKey,
        template_id: template.id,
        meta_ad_account_id: account.meta_ad_account_id,
        name: template.name,
        objective: template.objective,
        landing_page_url: template.landing_page_url,
        daily_budget_cents: dailyBudgetCents,
        status: "payment_required",
        desired_status: "paused",
      }).select("id,name,status,daily_budget_cents").single();
      if (campaignError) throw campaignError;
      await addEvent(campaign.id, "campaign_created", { template_id: template.id, daily_budget_cents: dailyBudgetCents });
      return json({ campaign });
    }

    if (action === "updateBudget") {
      const campaign = await getCampaign(body?.campaignId);
      const dailyBudgetCents = budgetToCents(body?.dailyBudget);
      const { error } = await admin.from("ad_campaigns").update({
        daily_budget_cents: dailyBudgetCents,
        last_budget_change_at: new Date().toISOString(),
      }).eq("id", campaign.id).eq("customer_id", userId);
      if (error) throw error;

      let job = null;
      if (campaign.meta_adset_id) job = await queueMetaAction(campaign, "update_budget", { daily_budget_cents: dailyBudgetCents });
      await addEvent(campaign.id, "budget_changed", { daily_budget_cents: dailyBudgetCents, meta_job_id: job?.id ?? null });
      return json({ ok: true, dailyBudgetCents, job });
    }

    if (action === "setEnabled") {
      const campaign = await getCampaign(body?.campaignId);
      const enabled = body?.enabled === true;
      const availableCents = Number(campaign.funded_cents) - Number(campaign.spent_cents);

      if (enabled && availableCents < Number(campaign.daily_budget_cents)) {
        await admin.from("ad_campaigns").update({ status: "payment_required", desired_status: "paused" }).eq("id", campaign.id);
        await addEvent(campaign.id, "activation_blocked_insufficient_funds", { available_cents: availableCents });
        return json({ ok: false, requiresFunding: true, availableCents }, 409);
      }

      const jobAction = enabled ? (campaign.meta_campaign_id ? "activate" : "create_campaign") : "pause";
      const { error } = await admin.from("ad_campaigns").update({
        desired_status: enabled ? "active" : "paused",
        status: enabled ? "ready" : "paused",
      }).eq("id", campaign.id).eq("customer_id", userId);
      if (error) throw error;

      const job = await queueMetaAction(campaign, jobAction, { requested_status: enabled ? "ACTIVE" : "PAUSED" });
      await addEvent(campaign.id, enabled ? "activation_requested" : "pause_requested", { meta_job_id: job.id });
      return json({ ok: true, job });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("managed-ad-campaigns", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
