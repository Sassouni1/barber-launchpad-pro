import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";
import {
  AGENCY_TOKEN_ENV,
  BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID,
  checkOfficialCampaign,
  countLeads,
  createAgencyClient,
  describeMetaError,
  insightsBelongTo,
  summarizeInsight,
  type AgencyClient,
  type InsightSummary,
} from "../_shared/metaAgency.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const FUNCTION_VERSION = 'managed-ad-reporting/linked-campaign-sync-2026-11-17';
const RANGE_DAYS = 30;

const toInt = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/* -------------------------------------------------------------------------- */
/* Server-only sync (scheduler or admin)                                       */
/* -------------------------------------------------------------------------- */

type SyncCampaign = { id: string; customer_id: string; meta_campaign_id: string; meta_ad_account_id: string };

async function syncOne(db: SupabaseClient, agency: AgencyClient, campaign: SyncCampaign) {
  const attemptAt = new Date().toISOString();
  const fail = async (reason: string) => {
    await db.from('ad_campaigns')
      .update({ last_metrics_sync_attempt_at: attemptAt, last_metrics_sync_error: reason })
      .eq('id', campaign.id)
      .eq('meta_campaign_id', campaign.meta_campaign_id);
    return { campaign_id: campaign.id, status: 'error', reason };
  };

  // Account scoping: only campaigns Meta says live in Barber Launch Official are ever read or stored.
  const meta = await agency.readCampaign(campaign.meta_campaign_id);
  if (!meta.ok) return fail(describeMetaError(meta.error));
  const check = checkOfficialCampaign(meta.data, { requirePaused: false });
  if (!check.ok) return fail(check.message);

  const until = isoDate(Date.now());
  const since = isoDate(Date.now() - (RANGE_DAYS - 1) * 86400000);
  const dailySince = isoDate(Date.now() - 34 * 86400000);

  const daily = await agency.readInsights(campaign.meta_campaign_id, { since: dailySince, until }, true);
  if (!daily.ok) return fail(describeMetaError(daily.error));
  const total = await agency.readInsights(campaign.meta_campaign_id, { since, until }, false);
  if (!total.ok) return fail(describeMetaError(total.error));
  if (!insightsBelongTo(daily.data, campaign.meta_campaign_id) || !insightsBelongTo(total.data, campaign.meta_campaign_id)) {
    return fail('Meta returned results for a different ad account or campaign; nothing was stored.');
  }

  const fetchedAt = new Date().toISOString();
  const rows = daily.data.map((r) => ({
    campaign_id: campaign.id,
    customer_id: campaign.customer_id,
    metric_date: String(r.date_start),
    spend_cents: Math.round(Number(r.spend ?? 0) * 100) || 0,
    total_reach: toInt(r.reach),
    total_impressions: toInt(r.impressions),
    total_leads: countLeads(r.actions),
    raw_insight: r,
    source_updated_at: null,
    fetched_at: fetchedAt,
  }));
  if (rows.length > 0) {
    const { error: upsertError } = await db.from('ad_campaign_metrics_daily').upsert(rows, { onConflict: 'campaign_id,metric_date' });
    if (upsertError) return fail('Could not store daily results.');
  }

  const summary: InsightSummary = summarizeInsight(total.data, since, until);
  const { error: updateError } = await db.from('ad_campaigns')
    .update({
      meta_metrics_30d: summary,
      last_metrics_sync_at: fetchedAt,
      last_metrics_sync_attempt_at: attemptAt,
      last_metrics_sync_error: null,
      meta_campaign_status: meta.data.status,
      meta_effective_status: meta.data.effective_status,
      meta_status_checked_at: fetchedAt,
    })
    .eq('id', campaign.id)
    .eq('meta_campaign_id', campaign.meta_campaign_id);
  if (updateError) return { campaign_id: campaign.id, status: 'error', reason: 'Could not store the results summary.' };
  return { campaign_id: campaign.id, status: 'ok', days: rows.length, has_delivery: summary.has_delivery };
}

async function runSync(onlyCampaignId?: string) {
  const token = Deno.env.get(AGENCY_TOKEN_ENV);
  if (!token) {
    return json({ status: 'unavailable', reason: 'not_configured', message: 'The server Meta token is not configured. No reporting data was written.' });
  }
  const db = admin();
  let query = db
    .from('ad_campaigns')
    .select('id,customer_id,meta_campaign_id,meta_ad_account_id')
    .not('meta_campaign_id', 'is', null)
    .eq('meta_ad_account_id', BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID)
    .neq('status', 'archived');
  if (onlyCampaignId) query = query.eq('id', onlyCampaignId);
  const { data: campaigns, error } = await query;
  if (error) return json({ error: 'Could not load linked campaigns.' }, 500);

  const agency = createAgencyClient(token);
  const results: Array<Record<string, unknown>> = [];
  for (const campaign of (campaigns ?? []) as SyncCampaign[]) {
    results.push(await syncOne(db, agency, campaign));
  }
  return json({ status: 'ok', synced_at: new Date().toISOString(), campaigns: results.length, results });
}

/* -------------------------------------------------------------------------- */
/* Member read                                                                 */
/* -------------------------------------------------------------------------- */

async function getResults(customerId: string, campaignId: string) {
  const db = admin();

  const { data: campaign, error: campaignError } = await db
    .from('ad_campaigns')
    .select('id,customer_id,meta_campaign_id,meta_metrics_30d,last_metrics_sync_at,last_metrics_sync_attempt_at,last_metrics_sync_error')
    .eq('id', campaignId)
    .eq('customer_id', customerId)
    .eq('member_visible', true)
    .maybeSingle();
  if (campaignError) return json({ error: 'Could not load results.' }, 500);
  if (!campaign) return json({ error: 'Campaign not found' }, 404);

  const configured = !!Deno.env.get(AGENCY_TOKEN_ENV);
  const lastSyncedAt = campaign.last_metrics_sync_at ?? null;
  // The member sees that a sync failed, never Meta's raw error text.
  const syncFailed = !!campaign.last_metrics_sync_error;
  const base = { range_days: RANGE_DAYS, last_synced_at: lastSyncedAt, sync_failed: syncFailed };

  if (!campaign.meta_campaign_id) return json({ available: false, reason: configured ? 'campaign_not_live' : 'not_configured', ...base });
  if (!configured) return json({ available: false, reason: 'not_configured', ...base });

  const summary = campaign.meta_metrics_30d as InsightSummary | null;
  if (!summary || !lastSyncedAt) return json({ available: false, reason: syncFailed ? 'sync_error' : 'not_synced', ...base });
  if (!summary.has_delivery) return json({ available: false, reason: 'no_data', ...base });

  const { count: appointmentCount } = await db
    .from('ad_campaign_appointments')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .eq('customer_id', customerId)
    .gte('booked_at', `${summary.since}T00:00:00Z`);
  const totalAppointments = appointmentCount ?? 0;

  // Spend is never returned to the member; it only derives cost-per-lead and cost-per-appointment.
  return json({
    available: true,
    ...base,
    range_start: summary.since,
    range_end: summary.until,
    last_updated_at: lastSyncedAt,
    total_leads: summary.leads,
    cost_per_lead_cents: summary.leads > 0 ? Math.round(summary.spend_cents / summary.leads) : null,
    total_reach: summary.reach,
    total_views: summary.impressions,
    appointments_available: totalAppointments > 0,
    total_appointments: totalAppointments > 0 ? totalAppointments : null,
    cost_per_appointment_cents: totalAppointments > 0 ? Math.round(summary.spend_cents / totalAppointments) : null,
  });
}

/* -------------------------------------------------------------------------- */

async function verifiedUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''));
  return error || !data?.claims?.sub ? null : data.claims.sub as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');

    if (action === 'sync') {
      // Scheduler-only: a hashed token in the database (x-cron-token) or the legacy shared secret.
      const cronToken = req.headers.get('x-cron-token');
      if (cronToken) {
        const { data: allowed, error } = await admin().rpc('verify_managed_ad_reporting_cron_token', { _token: cronToken });
        if (error || allowed !== true) return json({ error: 'Unauthorized' }, 401);
        return await runSync();
      }
      const provided = req.headers.get('x-reporting-sync-secret');
      const expected = Deno.env.get('REPORTING_SYNC_SECRET');
      if (!provided || !expected || provided !== expected) return json({ error: 'Unauthorized' }, 401);
      return await runSync();
    }

    if (action !== 'getResults' && action !== 'adminSync' && action !== 'functionVersion') {
      return json({ error: 'Invalid action' }, 400);
    }

    const userId = await verifiedUser(req);
    if (!userId) return json({ error: 'Unauthorized' }, 401);
    if (action === 'functionVersion') return json({ ok: true, version: FUNCTION_VERSION });

    if (action === 'adminSync') {
      // Admin role comes only from the protected user_roles table.
      const { data: role } = await admin().from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
      if (!role) return json({ error: 'Admins only.' }, 403);
      const only = typeof body?.campaign_id === 'string' && body.campaign_id ? body.campaign_id : undefined;
      return await runSync(only);
    }

    const campaignId = String(body?.campaign_id ?? '');
    if (!campaignId) return json({ error: 'campaign_id is required' }, 400);
    return await getResults(userId, campaignId);
  } catch (err) {
    console.error('managed-ad-reporting error', err instanceof Error ? err.message : err);
    return json({ error: 'Unexpected error' }, 500);
  }
});
