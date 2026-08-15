import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const META_API_VERSION = 'v21.0';

/** Meta action types that genuinely represent a lead. Anything else is ignored. */
const LEAD_ACTION_TYPES = new Set([
  'lead',
  'leadgen.other',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
  'onsite_web_lead',
  'onsite_conversion.lead',
]);

function countLeads(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  let best = 0;
  for (const raw of actions) {
    const a = raw as { action_type?: string; value?: string | number };
    if (!a?.action_type || !LEAD_ACTION_TYPES.has(a.action_type)) continue;
    const value = Number(a.value ?? 0);
    if (Number.isFinite(value) && value > best) best = value;
  }
  return Math.round(best);
}

const toInt = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/* -------------------------------------------------------------------------- */
/* Server-only sync                                                            */
/* -------------------------------------------------------------------------- */

async function runSync() {
  const token = Deno.env.get('META_ADS_ACCESS_TOKEN');
  if (!token) {
    return json(
      {
        status: 'unavailable',
        reason: 'not_configured',
        message: 'META_ADS_ACCESS_TOKEN is not configured. No reporting data was written.',
      },
      200,
    );
  }

  const db = admin();
  const { data: campaigns, error } = await db
    .from('ad_campaigns')
    .select('id,customer_id,meta_campaign_id')
    .neq('status', 'archived');
  if (error) return json({ error: error.message }, 400);

  const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);

  const results: Array<Record<string, unknown>> = [];

  for (const campaign of campaigns ?? []) {
    if (!campaign.meta_campaign_id) {
      results.push({ campaign_id: campaign.id, status: 'skipped', reason: 'no_meta_campaign_id' });
      continue;
    }

    const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${campaign.meta_campaign_id}/insights`);
    url.searchParams.set('time_increment', '1');
    url.searchParams.set('level', 'campaign');
    url.searchParams.set('fields', 'date_start,date_stop,reach,impressions,spend,actions,updated_time');
    url.searchParams.set('time_range', JSON.stringify({ since, until }));
    url.searchParams.set('limit', '100');

    let payload: { data?: unknown[]; error?: { message?: string } };
    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      payload = await res.json();
      if (!res.ok || payload?.error) {
        results.push({
          campaign_id: campaign.id,
          status: 'error',
          reason: payload?.error?.message ?? `Meta responded with ${res.status}`,
        });
        continue;
      }
    } catch (err) {
      results.push({
        campaign_id: campaign.id,
        status: 'error',
        reason: err instanceof Error ? err.message : 'Meta request failed',
      });
      continue;
    }

    const rows = (payload.data ?? []).map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        campaign_id: campaign.id,
        customer_id: campaign.customer_id,
        metric_date: String(r.date_start),
        spend_cents: Math.round(Number(r.spend ?? 0) * 100) || 0,
        total_reach: toInt(r.reach),
        total_impressions: toInt(r.impressions),
        total_leads: countLeads(r.actions),
        raw_insight: r,
        source_updated_at: r.updated_time ? new Date(String(r.updated_time)).toISOString() : null,
        fetched_at: new Date().toISOString(),
      };
    });

    if (rows.length === 0) {
      results.push({ campaign_id: campaign.id, status: 'ok', rows: 0 });
      continue;
    }

    const { error: upsertError } = await db
      .from('ad_campaign_metrics_daily')
      .upsert(rows, { onConflict: 'campaign_id,metric_date' });

    results.push(
      upsertError
        ? { campaign_id: campaign.id, status: 'error', reason: upsertError.message }
        : { campaign_id: campaign.id, status: 'ok', rows: rows.length },
    );
  }

  return json({ status: 'ok', synced_at: new Date().toISOString(), results });
}

/* -------------------------------------------------------------------------- */
/* Member read                                                                 */
/* -------------------------------------------------------------------------- */

async function getResults(customerId: string, campaignId: string) {
  const db = admin();

  const { data: campaign, error: campaignError } = await db
    .from('ad_campaigns')
    .select('id,customer_id,meta_campaign_id')
    .eq('id', campaignId)
    .eq('customer_id', customerId)
    .maybeSingle();
  if (campaignError) return json({ error: campaignError.message }, 400);
  if (!campaign) return json({ error: 'Campaign not found' }, 404);

  const configured = !!Deno.env.get('META_ADS_ACCESS_TOKEN');
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (!campaign.meta_campaign_id) {
    return json({
      available: false,
      reason: configured ? 'campaign_not_live' : 'not_configured',
      range_days: 30,
    });
  }

  const { data: metrics, error: metricsError } = await db
    .from('ad_campaign_metrics_daily')
    .select('spend_cents,total_reach,total_impressions,total_leads,fetched_at')
    .eq('campaign_id', campaign.id)
    .eq('customer_id', customerId)
    .gte('metric_date', since);
  if (metricsError) return json({ error: metricsError.message }, 400);

  if (!metrics || metrics.length === 0) {
    return json({ available: false, reason: 'no_data', range_days: 30 });
  }

  let spendCents = 0;
  let totalReach = 0;
  let totalViews = 0;
  let totalLeads = 0;
  let lastUpdated: string | null = null;
  for (const m of metrics) {
    spendCents += m.spend_cents ?? 0;
    totalReach += m.total_reach ?? 0;
    totalViews += m.total_impressions ?? 0;
    totalLeads += m.total_leads ?? 0;
    if (m.fetched_at && (!lastUpdated || m.fetched_at > lastUpdated)) lastUpdated = m.fetched_at;
  }

  const { count: appointmentCount } = await db
    .from('ad_campaign_appointments')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .eq('customer_id', customerId)
    .gte('booked_at', `${since}T00:00:00Z`);

  const totalAppointments = appointmentCount ?? 0;

  // Spend is intentionally never returned to the member — it is only used
  // server-side to derive cost-per-lead and cost-per-appointment.
  return json({
    available: true,
    range_days: 30,
    last_updated_at: lastUpdated,
    total_leads: totalLeads,
    cost_per_lead_cents: totalLeads > 0 ? Math.round(spendCents / totalLeads) : null,
    total_reach: totalReach,
    total_views: totalViews,
    appointments_available: totalAppointments > 0,
    total_appointments: totalAppointments > 0 ? totalAppointments : null,
    cost_per_appointment_cents:
      totalAppointments > 0 ? Math.round(spendCents / totalAppointments) : null,
  });
}

/* -------------------------------------------------------------------------- */

/**
 * Fallback shared secret used by the in-database hourly scheduler. The value
 * lives in Supabase Vault so the cron job never stores it in plaintext and the
 * browser can never reach it.
 */
async function readVaultSyncSecret(): Promise<string | null> {
  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) return null;
  const postgres = (await import('npm:postgres@3.4.4')).default;
  const sql = postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    const rows = await sql`
      select decrypted_secret from vault.decrypted_secrets
      where name = 'REPORTING_SYNC_SECRET' limit 1
    `;
    const value = rows[0]?.decrypted_secret as string | undefined;
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}



Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');

    if (action === 'sync') {
      // Server-only: authenticated by a shared scheduler secret, never a member JWT.
      const provided = req.headers.get('x-reporting-sync-secret');
      const expected = Deno.env.get('REPORTING_SYNC_SECRET') ?? (await readVaultSyncSecret());
      if (!expected) return json({ error: 'Sync is not configured' }, 503);
      if (!provided || provided !== expected) return json({ error: 'Unauthorized' }, 401);
      return await runSync();
    }


    if (action !== 'getResults') return json({ error: 'Invalid action' }, 400);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (claimsError || !claimsData?.claims?.sub) return json({ error: 'Unauthorized' }, 401);

    const campaignId = String(body?.campaign_id ?? '');
    if (!campaignId) return json({ error: 'campaign_id is required' }, 400);

    return await getResults(claimsData.claims.sub as string, campaignId);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
