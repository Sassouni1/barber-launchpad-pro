/**
 * Admin-facing Meta state for a customer campaign. A local status ("ready", "active") never
 * claims anything about Meta; only a stored Meta campaign ID and Meta's own effective_status do.
 */
export type AdMetaStage =
  | 'local_draft'
  | 'meta_creating'
  | 'meta_unknown'
  | 'meta_failed'
  | 'meta_paused'
  | 'meta_active'
  | 'meta_attention'
  | 'meta_stopped'
  | 'meta_unchecked';

export type AdMetaFields = {
  meta_campaign_id?: string | null;
  meta_create_status?: string | null;
  meta_effective_status?: string | null;
};

export function adMetaStage(c: AdMetaFields): AdMetaStage {
  if (!c.meta_campaign_id) {
    if (c.meta_create_status === 'creating') return 'meta_creating';
    if (c.meta_create_status === 'unknown') return 'meta_unknown';
    if (c.meta_create_status === 'failed') return 'meta_failed';
    return 'local_draft';
  }
  switch (c.meta_effective_status) {
    case 'ACTIVE':
      return 'meta_active';
    case 'PAUSED':
    case 'CAMPAIGN_PAUSED':
    case 'ADSET_PAUSED':
      return 'meta_paused';
    case 'DELETED':
    case 'ARCHIVED':
      return 'meta_stopped';
    case null:
    case undefined:
    case '':
      return 'meta_unchecked';
    default:
      return 'meta_attention';
  }
}

export const AD_META_STAGE_LABEL: Record<AdMetaStage, string> = {
  local_draft: 'Local draft · not in Meta',
  meta_creating: 'Creating in Meta…',
  meta_unknown: 'Meta outcome unknown',
  meta_failed: 'Meta create failed',
  meta_paused: 'Meta · PAUSED',
  meta_active: 'Meta · ACTIVE',
  meta_attention: 'Meta · needs attention',
  meta_stopped: 'Meta · deleted/archived',
  meta_unchecked: 'Meta · status not checked',
};

/** Only a draft with no Meta ID and no unfinished attempt may be created or linked. */
export const canCreateOrLink = (c: AdMetaFields) =>
  !c.meta_campaign_id && c.meta_create_status !== 'creating' && c.meta_create_status !== 'unknown';

/** Only an unfinished attempt needs the read-only Meta check. */
export const needsMetaCheck = (c: AdMetaFields) =>
  !c.meta_campaign_id && (c.meta_create_status === 'creating' || c.meta_create_status === 'unknown');

// Mirrors the ad_campaigns_min_daily_budget database rule: $0 (no budget yet) or at least $10/day.
export const MIN_DAILY_BUDGET_CENTS = 1000;
export function draftDailyBudgetCents(input: string): number | null {
  const cents = Math.round(Number(input || 0) * 100);
  if (!Number.isFinite(cents) || cents < 0) return null;
  return cents === 0 || cents >= MIN_DAILY_BUDGET_CENTS ? cents : null;
}
