// Pure decision rules for admin Meta campaign actions (no I/O), so they can be tested directly.
import { BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID } from "../_shared/metaAgency.ts";

/** A create attempt still "creating" after this long is treated as an unknown outcome. */
export const STALE_CREATE_MS = 5 * 60 * 1000;
/** An unknown outcome may be marked safe to retry only after Meta has had this long to show the campaign. */
export const UNKNOWN_SETTLE_MS = 10 * 60 * 1000;

export type LocalCampaign = {
  id: string;
  customer_id: string;
  name: string;
  objective: string;
  status: string;
  meta_ad_account_id: string;
  meta_campaign_id: string | null;
  meta_create_status: string | null;
  meta_create_started_at: string | null;
};

export type CreateGate =
  | { kind: 'already_linked'; metaCampaignId: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'reconcile_first' }
  | { kind: 'claim' };

/** What may happen when an admin asks to create the Meta campaign for a local draft. */
export function createGate(c: LocalCampaign, now = Date.now()): CreateGate {
  if (c.meta_campaign_id) return { kind: 'already_linked', metaCampaignId: c.meta_campaign_id };
  if (c.status === 'archived') return { kind: 'blocked', message: 'Archived campaigns cannot be created in Meta.' };
  if (c.meta_ad_account_id !== BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID) {
    return { kind: 'blocked', message: `This draft is assigned to ad account ${c.meta_ad_account_id}. Only Barber Launch Official (${BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID}) is supported.` };
  }
  if (c.meta_create_status === 'unknown') return { kind: 'reconcile_first' };
  if (c.meta_create_status === 'creating') {
    const started = c.meta_create_started_at ? Date.parse(c.meta_create_started_at) : NaN;
    if (Number.isFinite(started) && now - started < STALE_CREATE_MS) {
      return { kind: 'blocked', message: 'A Meta campaign is already being created for this draft. Wait a moment, then refresh.' };
    }
    return { kind: 'reconcile_first' };
  }
  if (c.meta_create_status === null || c.meta_create_status === 'failed') return { kind: 'claim' };
  return { kind: 'blocked', message: 'This campaign is already linked to Meta.' };
}

export type ReconcileDecision =
  | { kind: 'adopt'; metaCampaignId: string }
  | { kind: 'ambiguous'; count: number }
  | { kind: 'safe_to_retry' }
  | { kind: 'wait' };

/** Result of searching Barber Launch Official for this draft's marker after an unknown outcome. */
export function reconcileDecision(matchIds: string[], startedAt: string | null, now = Date.now()): ReconcileDecision {
  if (matchIds.length === 1) return { kind: 'adopt', metaCampaignId: matchIds[0] };
  if (matchIds.length > 1) return { kind: 'ambiguous', count: matchIds.length };
  const started = startedAt ? Date.parse(startedAt) : NaN;
  if (Number.isFinite(started) && now - started < UNKNOWN_SETTLE_MS) return { kind: 'wait' };
  return { kind: 'safe_to_retry' };
}

export type PageAccessRow = {
  connection_status: string | null;
  facebook_page_id: string | null;
  page_ad_access_status: string | null;
  page_ad_access_page_id: string | null;
} | null;

/** The customer's saved access must be granted for the currently selected Page before a live re-check. */
export function savedPageAccessGranted(row: PageAccessRow): { ok: true; pageId: string } | { ok: false; message: string } {
  if (!row || row.connection_status !== 'connected' || !row.facebook_page_id) {
    return { ok: false, message: "This customer hasn't connected a Facebook Page in Ads yet." };
  }
  if (row.page_ad_access_page_id !== row.facebook_page_id || row.page_ad_access_status !== 'granted') {
    return { ok: false, message: "This customer's Page advertising access isn't confirmed by Meta yet. They need to finish Give advertising access on /ads." };
  }
  return { ok: true, pageId: row.facebook_page_id };
}
