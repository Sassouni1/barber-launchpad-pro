// Admin-only Meta campaign actions for Barber Launch Official.
// Creates PAUSED campaign shells and links existing PAUSED campaigns; never activates, budgets or spends.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";
import { getAgencyToken } from '../_shared/metaAgencyCredential.ts';
import {
  AGENCY_TOKEN_ENV,
  agencyTokenProblem,
  BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID,
  buildPausedCampaignBody,
  campaignMarker,
  checkOfficialCampaign,
  createAgencyClient,
  describeMetaError,
  isMetaId,
  META_GRAPH_BASE,
  OBJECTIVE_BY_LOCAL,
  parseSpecialAdDeclaration,
  type AgencyClient,
  type MetaCampaign,
} from "../_shared/metaAgency.ts";
import { checkPageAdAccess, createGraphClient } from "../_shared/pageAdAccess.ts";
import { createGate, reconcileDecision, savedPageAccessGranted, type LocalCampaign } from "./logic.ts";

const FUNCTION_VERSION = 'managed-ad-meta-admin/paused-create-link-2026-11-17';
const LOCAL_FIELDS = 'id,customer_id,name,objective,status,meta_ad_account_id,meta_campaign_id,meta_create_status,meta_create_started_at,meta_create_attempt_id';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Db = SupabaseClient;
type Local = LocalCampaign & { meta_create_attempt_id: string | null };

const ACTIONS = ['functionVersion', 'status', 'createPausedCampaign', 'reconcileCreate', 'previewLink', 'confirmLink', 'refreshMetaStatus'] as const;
type Action = typeof ACTIONS[number];

async function loadLocal(db: Db, id: unknown): Promise<Local | null> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db.from('ad_campaigns').select(LOCAL_FIELDS).eq('id', id).maybeSingle();
  if (error) throw new Error('Could not load the campaign.');
  return data as Local | null;
}

const statusFields = (c: MetaCampaign | null, now: string) => c
  ? { meta_campaign_status: c.status, meta_effective_status: c.effective_status, meta_status_checked_at: now }
  : {};

async function logEvent(db: Db, local: Local, eventType: string, adminId: string) {
  // Members can read their own events, so no ad account or token details are stored here.
  await db.from('ad_campaign_events').insert({ customer_id: local.customer_id, campaign_id: local.id, event_type: eventType, detail: { by_admin: adminId } });
}

/* ---------------------------------- create --------------------------------- */

async function createPaused(db: Db, agency: AgencyClient, adminId: string, body: Record<string, unknown>): Promise<Response> {
  const local = await loadLocal(db, body.campaign_id);
  if (!local) return json({ error: 'Campaign not found.' }, 404);

  const gate = createGate(local);
  if (gate.kind === 'already_linked') return json({ ok: true, already: true, meta_campaign_id: gate.metaCampaignId });
  if (gate.kind === 'blocked') return json({ error: gate.message }, 409);
  // An earlier attempt has an unknown outcome: only read Meta now, never create in the same call.
  if (gate.kind === 'reconcile_first') return reconcile(db, agency, adminId, local);

  const declaration = parseSpecialAdDeclaration(body.special_ads);
  if (!declaration.ok) return json({ error: declaration.error, code: 'special_ads_required' }, 400);
  if (!OBJECTIVE_BY_LOCAL[local.objective]) return json({ error: `Objective "${local.objective}" can't be created in Meta.` }, 400);

  // The customer's Page advertising access must be confirmed now, live, with the same rules as /ads.
  const { data: connection, error: connectionError } = await db
    .from('ad_social_connections')
    .select('connection_status,facebook_page_id,page_ad_access_status,page_ad_access_page_id,page_ad_access_requested_at')
    .eq('customer_id', local.customer_id)
    .maybeSingle();
  if (connectionError) return json({ error: "Could not load the customer's Facebook connection." }, 500);
  const saved = savedPageAccessGranted(connection);
  if (!saved.ok) return json({ error: saved.message, code: 'page_access_missing' }, 409);
  const { data: pageTokens } = await db
    .from('ad_social_tokens')
    .select('page_access_token,facebook_page_id')
    .eq('customer_id', local.customer_id)
    .maybeSingle();
  if (!pageTokens?.page_access_token || pageTokens.facebook_page_id !== saved.pageId) {
    return json({ error: "The customer's Page login is missing. They need to reconnect Facebook on /ads.", code: 'page_access_missing' }, 409);
  }
  const priorAccepted = connection?.page_ad_access_page_id === saved.pageId && !!connection?.page_ad_access_requested_at;
  const live = await checkPageAdAccess(
    createGraphClient(META_GRAPH_BASE, fetch, await getAgencyToken(db)),
    saved.pageId,
    pageTokens.page_access_token,
    priorAccepted,
  );
  if (live.status !== 'granted') {
    return json({
      error: `Meta doesn't confirm advertising access to this customer's Page right now (${live.status}). ${live.message ?? ''}`.trim(),
      code: 'page_access_missing',
    }, 409);
  }

  // Atomic claim: only one create can be in flight for a draft, and never once a Meta ID exists.
  const attemptId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await db
    .from('ad_campaigns')
    .update({ meta_create_status: 'creating', meta_create_attempt_id: attemptId, meta_create_started_at: startedAt, meta_create_error: null })
    .eq('id', local.id)
    .eq('meta_ad_account_id', BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID)
    .is('meta_campaign_id', null)
    .or('meta_create_status.is.null,meta_create_status.eq.failed')
    .select('id');
  if (claimError) return json({ error: 'Could not start the Meta create.' }, 500);
  if (!claimed || claimed.length !== 1) return json({ error: 'Another create already started for this draft. Refresh and check its status.' }, 409);

  const finish = (patch: Record<string, unknown>) =>
    db.from('ad_campaigns').update(patch).eq('id', local.id).eq('meta_create_attempt_id', attemptId).is('meta_campaign_id', null).select('id');

  const payload = buildPausedCampaignBody({
    name: local.name,
    localCampaignId: local.id,
    localObjective: local.objective,
    specialAdCategories: declaration.categories,
  });
  const created = await agency.createPausedCampaign(payload);
  if (!created.ok || !created.data.id) {
    const definitive = !created.ok && created.definitive;
    const message = created.ok ? 'Meta replied without a campaign ID.' : describeMetaError(created.error);
    await finish({ meta_create_status: definitive ? 'failed' : 'unknown', meta_create_error: message });
    return json({
      error: definitive
        ? message
        : `${message} Meta's answer was unclear, so the campaign may or may not exist. Use "Check Meta" before trying again.`,
      outcome: definitive ? 'failed' : 'unknown',
    }, 502);
  }

  // Meta confirmed creation with an ID. Read it back to confirm the account before storing anything else.
  const now = new Date().toISOString();
  const back = await agency.readCampaign(created.data.id);
  if (back.ok) {
    const check = checkOfficialCampaign(back.data, { requirePaused: false });
    if (!check.ok) {
      await finish({ meta_create_status: 'unknown', meta_create_error: check.message });
      return json({ error: check.message, outcome: 'unknown' }, 502);
    }
  }
  const { data: saved2, error: saveError } = await finish({
    meta_campaign_id: created.data.id,
    meta_create_status: 'created',
    meta_create_error: null,
    meta_created_at: now,
    meta_page_id: saved.pageId,
    ...statusFields(back.ok ? back.data : null, now),
  });
  if (saveError || !saved2 || saved2.length !== 1) {
    // Leave the attempt as "creating"; Check Meta adopts it by its marker.
    return json({ error: `Meta created campaign ${created.data.id}, but saving it failed. Use "Check Meta" to attach it.` }, 500);
  }
  await logEvent(db, local, 'meta_campaign_created_paused', adminId);
  return json({
    ok: true,
    meta_campaign_id: created.data.id,
    meta_ad_account_id: BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID,
    meta_status: back.ok ? back.data.status : null,
    meta_effective_status: back.ok ? back.data.effective_status : null,
  });
}

/* --------------------------------- reconcile -------------------------------- */

async function reconcile(db: Db, agency: AgencyClient, adminId: string, local: Local): Promise<Response> {
  if (local.meta_campaign_id) return json({ ok: true, already: true, meta_campaign_id: local.meta_campaign_id });
  if (local.meta_create_status !== 'creating' && local.meta_create_status !== 'unknown') {
    return json({ error: 'There is no unfinished Meta create to check for this draft.' }, 409);
  }
  const found = await agency.findCampaignsByMarker(campaignMarker(local.id));
  if (!found.ok) return json({ error: describeMetaError(found.error), outcome: 'unknown' }, 502);
  const matches = found.data.filter((c) => checkOfficialCampaign(c, { requirePaused: false }).ok);
  const decision = reconcileDecision(matches.map((c) => c.id), local.meta_create_started_at);
  const patch = async (values: Record<string, unknown>) => {
    let q = db.from('ad_campaigns').update(values).eq('id', local.id).is('meta_campaign_id', null);
    if (local.meta_create_attempt_id) q = q.eq('meta_create_attempt_id', local.meta_create_attempt_id);
    return await q.select('id');
  };

  if (decision.kind === 'adopt') {
    const match = matches.find((c) => c.id === decision.metaCampaignId)!;
    const now = new Date().toISOString();
    const { data, error } = await patch({
      meta_campaign_id: match.id,
      meta_create_status: 'created',
      meta_create_error: null,
      meta_created_at: match.created_time ?? now,
      ...statusFields(match, now),
    });
    if (error || !data || data.length !== 1) return json({ error: 'Found the Meta campaign, but saving it failed. Refresh and try again.' }, 500);
    await logEvent(db, local, 'meta_campaign_created_paused', adminId);
    return json({ ok: true, reconciled: 'adopted', meta_campaign_id: match.id });
  }
  if (decision.kind === 'ambiguous') {
    const message = `Meta has ${decision.count} campaigns marked for this draft. Link the correct one manually.`;
    await patch({ meta_create_status: 'unknown', meta_create_error: message });
    return json({ error: message, outcome: 'unknown' }, 409);
  }
  if (decision.kind === 'wait') {
    await patch({ meta_create_status: 'unknown' });
    return json({ ok: true, reconciled: 'wait', message: "Meta doesn't show this campaign yet. Check again in a few minutes before creating it again." });
  }
  await patch({ meta_create_status: 'failed', meta_create_error: 'Meta has no campaign for this draft, so it is safe to create again.' });
  return json({ ok: true, reconciled: 'safe_to_retry', message: 'Meta has no campaign for this draft. You can create it again.' });
}

/* ----------------------------------- link ---------------------------------- */

type LinkContext =
  | { error: Response }
  | { local: Local; campaign: MetaCampaign; customer: { id: string; full_name: string | null; business_name: string | null; email: string | null } | null };

async function linkContext(db: Db, agency: AgencyClient, body: Record<string, unknown>): Promise<LinkContext> {
  const local = await loadLocal(db, body.campaign_id);
  if (!local) return { error: json({ error: 'Campaign not found.' }, 404) };
  if (local.meta_campaign_id) return { error: json({ error: 'This local campaign is already linked to a Meta campaign.' }, 409) };
  if (local.status === 'archived') return { error: json({ error: 'Archived campaigns cannot be linked.' }, 409) };
  if (local.meta_ad_account_id !== BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID) {
    return { error: json({ error: `This draft is assigned to ad account ${local.meta_ad_account_id}, not Barber Launch Official.` }, 409) };
  }
  if (local.meta_create_status === 'creating' || local.meta_create_status === 'unknown') {
    return { error: json({ error: 'A Meta create for this draft has an unfinished outcome. Use "Check Meta" first.' }, 409) };
  }
  const metaCampaignId = typeof body.meta_campaign_id === 'string' ? body.meta_campaign_id.trim() : '';
  if (!isMetaId(metaCampaignId)) return { error: json({ error: 'Enter the numeric Meta campaign ID.' }, 400) };

  const { data: existing } = await db.from('ad_campaigns').select('id,name').eq('meta_campaign_id', metaCampaignId).maybeSingle();
  if (existing) return { error: json({ error: `That Meta campaign is already linked to "${existing.name}".` }, 409) };

  const campaign = await agency.readCampaign(metaCampaignId);
  if (!campaign.ok) return { error: json({ error: describeMetaError(campaign.error) }, 502) };
  const check = checkOfficialCampaign(campaign.data, { requirePaused: true });
  if (!check.ok) {
    return { error: json({ error: check.message, meta: { id: campaign.data.id, account_id: campaign.data.account_id, status: campaign.data.status } }, 409) };
  }
  const { data: customer } = await db.from('profiles').select('id,full_name,business_name,email').eq('id', local.customer_id).maybeSingle();
  return { local, campaign: campaign.data, customer };
}

async function previewLink(db: Db, agency: AgencyClient, body: Record<string, unknown>): Promise<Response> {
  const ctx = await linkContext(db, agency, body);
  if ('error' in ctx) return ctx.error;
  const account = await agency.readAdAccount();
  return json({
    ok: true,
    preview: {
      account: { id: BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID, name: account.ok ? account.data.name : null },
      campaign: {
        id: ctx.campaign.id,
        name: ctx.campaign.name,
        status: ctx.campaign.status,
        effective_status: ctx.campaign.effective_status,
        objective: ctx.campaign.objective,
        created_time: ctx.campaign.created_time,
      },
      customer: {
        id: ctx.local.customer_id,
        name: ctx.customer?.business_name || ctx.customer?.full_name || null,
        email: ctx.customer?.email ?? null,
      },
      local: { id: ctx.local.id, name: ctx.local.name },
    },
  });
}

async function confirmLink(db: Db, agency: AgencyClient, adminId: string, body: Record<string, unknown>): Promise<Response> {
  const ctx = await linkContext(db, agency, body);
  if ('error' in ctx) return ctx.error;
  // The admin confirms the exact customer shown in the preview.
  if (body.customer_id !== ctx.local.customer_id) return json({ error: 'The customer changed since the preview. Preview again.' }, 409);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('ad_campaigns')
    .update({
      meta_campaign_id: ctx.campaign.id,
      meta_create_status: 'linked',
      meta_create_error: null,
      meta_linked_at: now,
      meta_linked_by: adminId,
      ...statusFields(ctx.campaign, now),
    })
    .eq('id', ctx.local.id)
    .eq('customer_id', ctx.local.customer_id)
    .eq('meta_ad_account_id', BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID)
    .is('meta_campaign_id', null)
    .select('id');
  if (error) {
    if (error.code === '23505') return json({ error: 'That Meta campaign is already linked to another campaign.' }, 409);
    return json({ error: 'Could not save the link.' }, 500);
  }
  if (!data || data.length !== 1) return json({ error: 'This local campaign changed. Refresh and try again.' }, 409);
  await logEvent(db, ctx.local, 'meta_campaign_linked', adminId);
  return json({ ok: true, meta_campaign_id: ctx.campaign.id });
}

/* ---------------------------------- status --------------------------------- */

async function refreshMetaStatus(db: Db, agency: AgencyClient, body: Record<string, unknown>): Promise<Response> {
  const local = await loadLocal(db, body.campaign_id);
  if (!local) return json({ error: 'Campaign not found.' }, 404);
  if (!local.meta_campaign_id) return json({ error: 'This campaign is a local draft only; nothing to read from Meta.' }, 409);
  const campaign = await agency.readCampaign(local.meta_campaign_id);
  if (!campaign.ok) return json({ error: describeMetaError(campaign.error) }, 502);
  const check = checkOfficialCampaign(campaign.data, { requirePaused: false });
  if (!check.ok) return json({ error: check.message }, 409);
  const now = new Date().toISOString();
  const { error } = await db.from('ad_campaigns').update(statusFields(campaign.data, now)).eq('id', local.id).eq('meta_campaign_id', local.meta_campaign_id);
  if (error) return json({ error: 'Could not save the Meta status.' }, 500);
  return json({ ok: true, status: campaign.data.status, effective_status: campaign.data.effective_status, checked_at: now });
}

async function connectionStatus(token: string | undefined): Promise<Response> {
  if (!token) {
    return json({ ok: true, configured: false, account_id: BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID, message: 'No server Meta token is configured yet.' });
  }
  if (agencyTokenProblem(token) === 'invalid') {
    return json({ ok: true, configured: true, reachable: false, account_id: BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID, message: "The saved server Meta token isn't a valid access token (it contains characters Meta tokens never have). Re-enter it." });
  }
  const agency = createAgencyClient(token);
  const account = await agency.readAdAccount();
  if (!account.ok) {
    return json({ ok: true, configured: true, reachable: false, account_id: BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID, message: describeMetaError(account.error) });
  }
  const [permissions, campaigns] = await Promise.all([agency.readGrantedPermissions(), agency.listCampaigns()]);
  const needed = ['ads_management', 'ads_read', 'business_management'];
  return json({
    ok: true,
    configured: true,
    reachable: true,
    account_id: BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID,
    account: account.data,
    permissions: permissions.ok
      ? { readable: true, missing: needed.filter((p) => !permissions.data.includes(p)) }
      : { readable: false, message: describeMetaError(permissions.error) },
    campaigns: campaigns.ok
      ? campaigns.data.map((c) => ({ id: c.id, name: c.name, status: c.status, effective_status: c.effective_status }))
      : null,
  });
}

/* --------------------------------- handler --------------------------------- */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsError } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    const adminId = claims?.claims?.sub as string | undefined;
    if (claimsError || !adminId) return json({ error: 'Unauthorized' }, 401);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Admin role comes from the protected user_roles table only.
    const { data: role, error: roleError } = await db.from('user_roles').select('role').eq('user_id', adminId).eq('role', 'admin').maybeSingle();
    if (roleError) return json({ error: 'Could not verify admin access.' }, 500);
    if (!role) return json({ error: 'Admins only.' }, 403);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = body.action as Action;
    if (!ACTIONS.includes(action)) return json({ error: 'Invalid action' }, 400);
    if (action === 'functionVersion') return json({ ok: true, version: FUNCTION_VERSION });

    const token = await getAgencyToken(db);
    if (action === 'status') return await connectionStatus(token);
    if (!token) {
      return json({ error: 'The Barber Launch server Meta token (ads_management) is not configured, so nothing was sent to Meta.', code: 'token_missing' }, 503);
    }
    const agency = createAgencyClient(token);

    if (action === 'createPausedCampaign') return await createPaused(db, agency, adminId, body);
    if (action === 'reconcileCreate') {
      const local = await loadLocal(db, body.campaign_id);
      if (!local) return json({ error: 'Campaign not found.' }, 404);
      return await reconcile(db, agency, adminId, local);
    }
    if (action === 'previewLink') return await previewLink(db, agency, body);
    if (action === 'confirmLink') return await confirmLink(db, agency, adminId, body);
    return await refreshMetaStatus(db, agency, body);
  } catch (err) {
    console.error('managed-ad-meta-admin error', err instanceof Error ? err.message : err);
    return json({ error: 'Unexpected error' }, 500);
  }
});
