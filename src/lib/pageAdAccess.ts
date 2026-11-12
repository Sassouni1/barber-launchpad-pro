/** unverified: Barber Launch is listed on the Page, but Meta can't show it has advertising access. */
export type PageAdAccessStatus = 'unknown' | 'pending' | 'unverified' | 'granted' | 'error';

export type PageAdAccessFields = {
  facebook_page_id?: string | null;
  page_ad_access_status?: string | null;
  page_ad_access_page_id?: string | null;
  page_ad_access_checked_at?: string | null;
  page_ad_access_error?: string | null;
  page_ad_access_requested_at?: string | null;
};

/** Matches the server's PAGE_AD_RETRY_AFTER_MS; the server enforces it. */
export const PAGE_AD_RETRY_AFTER_MS = 15 * 60 * 1000;

export type PageAdAccessView = {
  status: PageAdAccessStatus;
  checkedAt: string | null;
  message: string | null;
  /** When Facebook accepted Barber Launch's advertising request for this Page. */
  requestedAt: string | null;
};

const STATUSES: PageAdAccessStatus[] = ['unknown', 'pending', 'unverified', 'granted', 'error'];

/**
 * The saved access state only counts for the Page it was checked against.
 * Anything missing, unrecognised or for another Page reads as "unknown".
 */
export function pageAdAccessFor(connection: PageAdAccessFields | null | undefined): PageAdAccessView {
  const unknown: PageAdAccessView = { status: 'unknown', checkedAt: null, message: null, requestedAt: null };
  if (!connection?.facebook_page_id) return unknown;
  if (connection.page_ad_access_page_id !== connection.facebook_page_id) return unknown;
  const status = STATUSES.find((s) => s === connection.page_ad_access_status);
  if (!status) return unknown;
  return {
    status,
    checkedAt: connection.page_ad_access_checked_at ?? null,
    message: connection.page_ad_access_error ?? null,
    requestedAt: connection.page_ad_access_requested_at ?? null,
  };
}

/** Offer "Send request again" only for a pending request Facebook accepted long enough ago. */
export function canResendPageAdAccess(view: PageAdAccessView, now: number = Date.now()): boolean {
  if (view.status !== 'pending' || !view.requestedAt) return false;
  const accepted = Date.parse(view.requestedAt);
  return Number.isFinite(accepted) && now - accepted >= PAGE_AD_RETRY_AFTER_MS;
}
