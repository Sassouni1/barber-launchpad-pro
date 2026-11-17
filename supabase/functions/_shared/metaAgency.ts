// Barber Launch's own (agency) Meta Marketing API access. Server-only.
// The token in META_ADS_ACCESS_TOKEN belongs to a Barber Launch system user; it never leaves the server
// and is never sent to members or admins. Every campaign operation is confined to the
// Barber Launch Official ad account, and nothing here can activate delivery or set a budget.

export const META_GRAPH_VERSION = 'v27.0';
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID = '2895514127400266';
export const AGENCY_TOKEN_ENV = 'META_ADS_ACCESS_TOKEN';

export type MetaError = {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  error_user_title?: string;
  is_transient?: boolean;
};

/** `definitive` is true only when Meta answered with an error, so a write certainly did not happen. */
export type MetaResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: MetaError; definitive: boolean };

export type MetaCampaign = {
  id: string;
  name: string | null;
  status: string | null;
  configured_status: string | null;
  effective_status: string | null;
  account_id: string | null;
  objective: string | null;
  created_time: string | null;
};

export type MetaAdAccount = {
  account_id: string | null;
  name: string | null;
  account_status: number | null;
  currency: string | null;
  timezone_name: string | null;
  business: { id: string | null; name: string | null } | null;
};

export type InsightRow = Record<string, unknown>;

export const CAMPAIGN_FIELDS = 'id,name,status,configured_status,effective_status,account_id,objective,created_time';
export const INSIGHT_FIELDS = 'account_id,campaign_id,date_start,date_stop,reach,impressions,spend,actions';

export const isMetaId = (value: unknown): value is string => typeof value === 'string' && /^\d{5,32}$/.test(value);
export const normalizeAccountId = (value: unknown): string | null =>
  typeof value === 'string' && value ? value.replace(/^act_/, '') : null;

/* -------------------------------------------------------------------------- */
/* Pure rules                                                                  */
/* -------------------------------------------------------------------------- */

export const OBJECTIVE_BY_LOCAL: Readonly<Record<string, string>> = Object.freeze({
  lead_generation: 'OUTCOME_LEADS',
  messages: 'OUTCOME_ENGAGEMENT',
  traffic: 'OUTCOME_TRAFFIC',
  sales: 'OUTCOME_SALES',
});

export const SPECIAL_AD_CATEGORIES = Object.freeze([
  'HOUSING',
  'EMPLOYMENT',
  'FINANCIAL_PRODUCTS_SERVICES',
  'ISSUES_ELECTIONS_POLITICS',
]);

/**
 * The admin must explicitly declare special ad categories: { declaration: 'none' } or
 * { declaration: 'categories', categories: [...] }. A missing answer is never treated as "none".
 */
export function parseSpecialAdDeclaration(input: unknown): { ok: true; categories: string[] } | { ok: false; error: string } {
  const value = input as { declaration?: unknown; categories?: unknown } | null;
  if (value?.declaration === 'none') return { ok: true, categories: [] };
  if (value?.declaration === 'categories' && Array.isArray(value.categories)) {
    const unique = [...new Set(value.categories)];
    if (unique.length > 0 && unique.every((c) => typeof c === 'string' && SPECIAL_AD_CATEGORIES.includes(c))) {
      return { ok: true, categories: unique as string[] };
    }
  }
  return { ok: false, error: 'Declare the special ad categories for this campaign (or confirm none apply) before creating it in Meta.' };
}

export const campaignMarker = (localCampaignId: string) => `BL-${localCampaignId}`;

/**
 * Body for POST /act_{id}/campaigns. Always PAUSED, with no budget, no bid strategy and no ad sets,
 * so the campaign cannot deliver or spend.
 */
export function buildPausedCampaignBody(input: { name: string; localCampaignId: string; localObjective: string; specialAdCategories: string[] }) {
  const objective = OBJECTIVE_BY_LOCAL[input.localObjective];
  if (!objective) throw new Error(`Unsupported objective: ${input.localObjective}`);
  const human = input.name.trim().slice(0, 300) || 'Barber Launch campaign';
  return {
    name: `${human} · ${campaignMarker(input.localCampaignId)}`,
    objective,
    status: 'PAUSED',
    special_ad_categories: input.specialAdCategories,
    // Required when the budget lives on ad sets; no ad sets are created here.
    is_adset_budget_sharing_enabled: false,
  } as const;
}

export type OfficialCheck =
  | { ok: true }
  | { ok: false; reason: 'wrong_account' | 'not_paused' | 'invalid'; message: string };

/** A Meta campaign may be stored or linked only when Meta says it lives in Barber Launch Official. */
export function checkOfficialCampaign(campaign: MetaCampaign | null | undefined, opts: { requirePaused: boolean }): OfficialCheck {
  if (!campaign || !isMetaId(campaign.id)) return { ok: false, reason: 'invalid', message: 'Meta did not return a valid campaign.' };
  const account = normalizeAccountId(campaign.account_id);
  if (account !== BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID) {
    return {
      ok: false,
      reason: 'wrong_account',
      message: `This campaign is in ad account ${account ?? 'unknown'}, not Barber Launch Official (${BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID}).`,
    };
  }
  if (opts.requirePaused && campaign.status !== 'PAUSED') {
    return { ok: false, reason: 'not_paused', message: `Meta shows this campaign as ${campaign.status ?? 'unknown'}. Only PAUSED campaigns can be linked.` };
  }
  return { ok: true };
}

export type DeliveryState = 'paused' | 'active' | 'attention' | 'stopped' | 'unknown';

/** Meta's effective_status decides whether a campaign can deliver; configured status alone does not. */
export function deliveryState(effectiveStatus: string | null | undefined): DeliveryState {
  switch (effectiveStatus) {
    case 'ACTIVE':
      return 'active';
    case 'PAUSED':
    case 'CAMPAIGN_PAUSED':
    case 'ADSET_PAUSED':
      return 'paused';
    case 'IN_PROCESS':
    case 'PENDING_REVIEW':
    case 'WITH_ISSUES':
    case 'DISAPPROVED':
    case 'PREAPPROVED':
    case 'PENDING_BILLING_INFO':
      return 'attention';
    case 'DELETED':
    case 'ARCHIVED':
      return 'stopped';
    default:
      return 'unknown';
  }
}

/** Overlapping lead action types are alternatives, not counts to add. */
const LEAD_ALTERNATIVES = [
  'onsite_conversion.lead_grouped',
  'leadgen_grouped',
  'offsite_conversion.fb_pixel_lead',
  'onsite_web_lead',
  'onsite_conversion.lead',
  'leadgen.other',
];

/** Meta's aggregate `lead` count when present; otherwise the largest single alternative. Never a sum. */
export function countLeads(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  const byType = new Map<string, number>();
  for (const raw of actions) {
    const a = raw as { action_type?: unknown; value?: unknown };
    if (typeof a?.action_type !== 'string') continue;
    const value = Number(a.value ?? 0);
    if (!Number.isFinite(value) || value <= 0) continue;
    byType.set(a.action_type, Math.max(byType.get(a.action_type) ?? 0, value));
  }
  if (byType.has('lead')) return Math.round(byType.get('lead')!);
  let best = 0;
  for (const type of LEAD_ALTERNATIVES) best = Math.max(best, byType.get(type) ?? 0);
  return Math.round(best);
}

const toInt = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export type InsightSummary = {
  since: string;
  until: string;
  reach: number;
  impressions: number;
  spend_cents: number;
  leads: number;
  has_delivery: boolean;
};

/** One aggregate insights row (no time_increment) → stored summary. Reach is Meta's deduplicated value. */
export function summarizeInsight(rows: InsightRow[], since: string, until: string): InsightSummary {
  const row = rows[0] ?? {};
  const summary = {
    since,
    until,
    reach: toInt(row.reach),
    impressions: toInt(row.impressions),
    spend_cents: Math.round(Number(row.spend ?? 0) * 100) || 0,
    leads: countLeads(row.actions),
  };
  return { ...summary, has_delivery: rows.length > 0 && (summary.impressions > 0 || summary.reach > 0) };
}

/** Rejects insight rows Meta attributes to another ad account or campaign. */
export function insightsBelongTo(rows: InsightRow[], metaCampaignId: string, accountId = BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID): boolean {
  return rows.every((r) =>
    normalizeAccountId(r.account_id) === accountId && (r.campaign_id === undefined || String(r.campaign_id) === metaCampaignId)
  );
}

/** Admin-facing description of a Meta error. Contains Meta's words, never a token. */
export function describeMetaError(error: MetaError): string {
  const code = typeof error.code === 'number' ? error.code : null;
  const said = (error.error_user_msg || error.message || '').trim();
  const suffix = said ? ` Meta said: "${said}"${code !== null ? ` (code ${code})` : ''}` : '';
  if (code === 190) return `The Barber Launch Meta token is invalid or expired. Generate a new system user token.${suffix}`;
  if (code === 10 || (code !== null && code >= 200 && code < 300)) {
    return `The Barber Launch Meta token lacks permission for this (needs ads_management/ads_read and the ad account assigned).${suffix}`;
  }
  if (code !== null && [4, 17, 32, 613, 80000, 80004].includes(code)) return `Meta is rate limiting requests. Try again in a few minutes.${suffix}`;
  return `Meta request failed.${suffix}`;
}

/* -------------------------------------------------------------------------- */
/* HTTP adapter                                                                */
/* -------------------------------------------------------------------------- */

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

async function call<T>(fetchImpl: FetchLike, url: string | URL, init: RequestInit, pick: (p: Record<string, unknown>) => T): Promise<MetaResult<T>> {
  let res: Response;
  try {
    res = await fetchImpl(url, init);
  } catch {
    return { ok: false, status: 0, error: { message: 'Could not reach Meta.' }, definitive: false };
  }
  const payload = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (res.ok && payload && !payload.error) return { ok: true, data: pick(payload) };
  const raw = payload?.error && typeof payload.error === 'object' ? payload.error as MetaError : null;
  const error: MetaError = raw ? { ...raw } : { message: `Meta returned HTTP ${res.status}` };
  // Only a 4xx carrying Meta's own non-transient error proves nothing was written.
  const definitive = res.status >= 400 && res.status < 500 && !!raw && raw.is_transient !== true;
  return { ok: false, status: res.status, error, definitive };
}

const asCampaign = (p: Record<string, unknown>): MetaCampaign => ({
  id: String(p.id ?? ''),
  name: typeof p.name === 'string' ? p.name : null,
  status: typeof p.status === 'string' ? p.status : null,
  configured_status: typeof p.configured_status === 'string' ? p.configured_status : null,
  effective_status: typeof p.effective_status === 'string' ? p.effective_status : null,
  account_id: normalizeAccountId(p.account_id),
  objective: typeof p.objective === 'string' ? p.objective : null,
  created_time: typeof p.created_time === 'string' ? p.created_time : null,
});

export type AgencyClient = ReturnType<typeof createAgencyClient>;

export function createAgencyClient(token: string, fetchImpl: FetchLike = fetch, base = META_GRAPH_BASE) {
  const headers = { Authorization: `Bearer ${token}` };

  async function paged<T>(first: URL, map: (row: Record<string, unknown>) => T, maxPages = 10): Promise<MetaResult<T[]>> {
    const all: T[] = [];
    let url: URL = first;
    for (let i = 0; i < maxPages; i++) {
      const page = await call(fetchImpl, url, { headers }, (p) => p);
      if (!page.ok) return page;
      const data = page.data.data;
      if (!Array.isArray(data)) return { ok: false, status: 502, error: { message: 'Meta returned an invalid list.' }, definitive: false };
      all.push(...(data as Record<string, unknown>[]).map(map));
      const paging = page.data.paging as { next?: string; cursors?: { after?: string } } | undefined;
      const after = paging?.cursors?.after;
      if (!paging?.next || typeof after !== 'string') return { ok: true, data: all };
      url = new URL(first);
      url.searchParams.set('after', after);
    }
    return { ok: false, status: 502, error: { message: 'Meta returned more results than can be checked safely.' }, definitive: false };
  }

  return {
    readAdAccount(accountId = BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID): Promise<MetaResult<MetaAdAccount>> {
      const url = new URL(`${base}/act_${accountId}`);
      url.searchParams.set('fields', 'account_id,name,account_status,currency,timezone_name,business{id,name}');
      return call(fetchImpl, url, { headers }, (p) => {
        const business = p.business as { id?: unknown; name?: unknown } | undefined;
        return {
          account_id: normalizeAccountId(p.account_id),
          name: typeof p.name === 'string' ? p.name : null,
          account_status: typeof p.account_status === 'number' ? p.account_status : null,
          currency: typeof p.currency === 'string' ? p.currency : null,
          timezone_name: typeof p.timezone_name === 'string' ? p.timezone_name : null,
          business: business ? { id: typeof business.id === 'string' ? business.id : null, name: typeof business.name === 'string' ? business.name : null } : null,
        };
      });
    },

    readCampaign(campaignId: string): Promise<MetaResult<MetaCampaign>> {
      const url = new URL(`${base}/${campaignId}`);
      url.searchParams.set('fields', CAMPAIGN_FIELDS);
      return call(fetchImpl, url, { headers }, asCampaign);
    },

    /** Always posts to Barber Launch Official with the PAUSED body from buildPausedCampaignBody. */
    createPausedCampaign(body: ReturnType<typeof buildPausedCampaignBody>): Promise<MetaResult<{ id: string | null }>> {
      if (body.status !== 'PAUSED') throw new Error('Refusing to create a campaign that is not PAUSED.');
      const form = new URLSearchParams({
        name: body.name,
        objective: body.objective,
        status: 'PAUSED',
        special_ad_categories: JSON.stringify(body.special_ad_categories),
        is_adset_budget_sharing_enabled: 'false',
      });
      return call(
        fetchImpl,
        `${base}/act_${BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID}/campaigns`,
        { method: 'POST', headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form },
        (p) => ({ id: isMetaId(p.id) ? p.id : null }),
      );
    },

    /** Read-only: campaigns in Barber Launch Official whose name carries this exact marker. */
    async findCampaignsByMarker(marker: string): Promise<MetaResult<MetaCampaign[]>> {
      const url = new URL(`${base}/act_${BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID}/campaigns`);
      url.searchParams.set('fields', CAMPAIGN_FIELDS);
      url.searchParams.set('limit', '200');
      url.searchParams.set('filtering', JSON.stringify([{ field: 'name', operator: 'CONTAIN', value: marker }]));
      const result = await paged(url, asCampaign);
      if (!result.ok) return result;
      return { ok: true, data: result.data.filter((c) => typeof c.name === 'string' && c.name.includes(marker)) };
    },

    readInsights(campaignId: string, range: { since: string; until: string }, daily: boolean): Promise<MetaResult<InsightRow[]>> {
      const url = new URL(`${base}/${campaignId}/insights`);
      url.searchParams.set('level', 'campaign');
      url.searchParams.set('fields', INSIGHT_FIELDS);
      url.searchParams.set('time_range', JSON.stringify(range));
      url.searchParams.set('limit', '100');
      if (daily) url.searchParams.set('time_increment', '1');
      return paged(url, (r) => r);
    },
  };
}
