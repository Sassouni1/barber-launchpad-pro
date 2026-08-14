import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderTemplate(value: unknown, variables: Record<string, string>) : unknown {
  if (typeof value === "string") return value.replace(/{{([a-z_]+)}}/g, (_, key) => variables[key] ?? "");
  if (Array.isArray(value)) return value.map((item) => renderTemplate(item, variables));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, renderTemplate(item, variables)]));
  }
  return value;
}

function retryAt(attempts: number) {
  const minutes = Math.min(60, 2 ** Math.min(attempts, 6));
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const dispatchSecret = Deno.env.get("MANAGED_AD_DISPATCH_SECRET");
  if (!dispatchSecret || req.headers.get("x-managed-ad-dispatch-secret") !== dispatchSecret) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bridgeUrl = Deno.env.get("COMMANDIQ_MANAGED_ADS_URL");
  const bridgeSecret = Deno.env.get("COMMANDIQ_MANAGED_ADS_SECRET");
  if (!bridgeUrl || !bridgeSecret) return json({ error: "CommandIQ managed-Meta bridge is not configured" }, 503);
  const admin = createClient(supabaseUrl, serviceKey);
  let claimedJob: { id: string; attempts: number } | null = null;

  try {
    const { data: claimed, error: claimError } = await admin.rpc("claim_next_ad_meta_action_job");
    if (claimError) throw claimError;
    const job = claimed?.[0];
    if (!job) return json({ processed: false });
    claimedJob = { id: job.id, attempts: Number(job.attempts) };

    const { data: campaign, error: campaignError } = await admin
      .from("ad_campaigns")
      .select("*, ad_campaign_templates(*), profiles!ad_campaigns_customer_id_fkey(business_name,business_city,business_state,full_name,email)")
      .eq("id", job.campaign_id)
      .eq("customer_id", job.customer_id)
      .single();
    if (campaignError || !campaign) throw campaignError || new Error("Campaign not found");

    const profile = campaign.profiles || {};
    const variables = {
      business_name: profile.business_name || profile.full_name || "Barber Launch member",
      business_city: profile.business_city || "",
      business_state: profile.business_state || "",
      customer_id: campaign.customer_id,
      campaign_id: campaign.id,
    };
    const template = campaign.ad_campaign_templates;
    const payload = job.payload || {};
    let bridgeRequest: Record<string, unknown>;

    if (job.action === "create_campaign") {
      if (!template?.active) throw new Error("Campaign template is inactive or missing");
      bridgeRequest = {
        action: "create_campaign",
        idempotencyKey: job.idempotency_key,
        accountId: campaign.meta_ad_account_id,
        campaign: { name: campaign.name, objective: campaign.objective, status: "PAUSED" },
        adset: {
          name: `${campaign.name} — ${variables.business_city || "local"}`,
          daily_budget: campaign.daily_budget_cents,
          ...(renderTemplate(template.targeting_config, variables) as Record<string, unknown>),
        },
        creative: renderTemplate(template.creative_config, variables),
        ad: { name: `${campaign.name} — ${variables.business_name}`, status: "PAUSED" },
      };
    } else if (job.action === "activate" || job.action === "pause") {
      if (!campaign.meta_campaign_id) throw new Error("Meta campaign has not been created");
      bridgeRequest = {
        action: "set_status",
        idempotencyKey: job.idempotency_key,
        accountId: campaign.meta_ad_account_id,
        entityId: campaign.meta_campaign_id,
        status: job.action === "activate" ? "ACTIVE" : "PAUSED",
      };
    } else if (job.action === "update_budget") {
      if (!campaign.meta_adset_id) throw new Error("Meta ad set has not been created");
      bridgeRequest = {
        action: "update_budget",
        idempotencyKey: job.idempotency_key,
        accountId: campaign.meta_ad_account_id,
        entityId: campaign.meta_adset_id,
        dailyBudgetCents: Number(payload.daily_budget_cents ?? campaign.daily_budget_cents),
      };
    } else if (job.action === "sync_insights") {
      if (!campaign.meta_campaign_id) throw new Error("Meta campaign has not been created");
      bridgeRequest = {
        action: "get_insights",
        idempotencyKey: job.idempotency_key,
        accountId: campaign.meta_ad_account_id,
        entityId: campaign.meta_campaign_id,
      };
    } else {
      throw new Error(`Unsupported job action: ${job.action}`);
    }

    const bridgeResponse = await fetch(bridgeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-barber-launch-ads-secret": bridgeSecret },
      body: JSON.stringify(bridgeRequest),
    });
    const result = await bridgeResponse.json();
    if (!bridgeResponse.ok || result?.error) throw new Error(result?.error || `CommandIQ bridge failed (${bridgeResponse.status})`);

    if (job.action === "create_campaign") {
      const { error } = await admin.from("ad_campaigns").update({
        meta_campaign_id: result.campaignId,
        meta_adset_id: result.adsetId,
        meta_ad_id: result.adId,
        last_meta_status: "PAUSED",
        status: campaign.desired_status === "active" ? "ready" : "paused",
        last_meta_sync_at: new Date().toISOString(),
      }).eq("id", campaign.id);
      if (error) throw error;
      if (campaign.desired_status === "active") {
        await admin.from("ad_meta_action_jobs").insert({
          campaign_id: campaign.id,
          customer_id: campaign.customer_id,
          action: "activate",
          payload: {},
          idempotency_key: crypto.randomUUID(),
        });
      }
    } else if (job.action === "activate" || job.action === "pause") {
      const status = job.action === "activate" ? "active" : "paused";
      const { error } = await admin.from("ad_campaigns").update({ status, last_meta_status: job.action === "activate" ? "ACTIVE" : "PAUSED", last_meta_sync_at: new Date().toISOString() }).eq("id", campaign.id);
      if (error) throw error;
    } else if (job.action === "sync_insights") {
      const totalSpentCents = Math.max(0, Math.round(Number(result.spend ?? 0) * 100));
      const recordedSpent = Number(campaign.spent_cents);
      if (totalSpentCents > recordedSpent) {
        const { error } = await admin.from("ad_spend_ledger_entries").insert({
          campaign_id: campaign.id,
          customer_id: campaign.customer_id,
          entry_type: "spend",
          amount_cents: -(totalSpentCents - recordedSpent),
          external_reference: `meta-spend-${campaign.meta_campaign_id}-${totalSpentCents}`,
          note: "Meta reported spend",
        });
        if (error && error.code !== "23505") throw error;
      }
    }

    await admin.from("ad_meta_action_jobs").update({ status: "succeeded", completed_at: new Date().toISOString(), external_reference: result.requestId || null }).eq("id", job.id);
    await admin.from("ad_campaign_events").insert({ customer_id: campaign.customer_id, campaign_id: campaign.id, event_type: `meta_${job.action}_succeeded`, detail: { meta_job_id: job.id } });
    return json({ processed: true, jobId: job.id });
  } catch (error) {
    console.error("managed-ad-dispatch", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    // Claim errors happen before a job exists; otherwise persist a bounded retry.
    try {
      if (claimedJob) {
        const terminal = claimedJob.attempts >= 5;
        await admin.from("ad_meta_action_jobs").update({
          status: terminal ? "failed" : "retryable_failed",
          last_error: message,
          run_after: retryAt(claimedJob.attempts),
        }).eq("id", claimedJob.id);
      }
    } catch (persistenceError) {
      console.error("Could not persist dispatch failure", persistenceError);
    }
    return json({ error: message }, 500);
  }
});
