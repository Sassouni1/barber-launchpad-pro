export type PageAdAccessStatus = 'unknown' | 'pending' | 'granted' | 'error';

export type PageAdAccessFields = {
  facebook_page_id?: string | null;
  page_ad_access_status?: string | null;
  page_ad_access_page_id?: string | null;
  page_ad_access_checked_at?: string | null;
  page_ad_access_error?: string | null;
};

export type PageAdAccessView = {
  status: PageAdAccessStatus;
  checkedAt: string | null;
  message: string | null;
};

const STATUSES: PageAdAccessStatus[] = ['unknown', 'pending', 'granted', 'error'];

/**
 * The saved access state only counts for the Page it was checked against.
 * Anything missing, unrecognised or for another Page reads as "unknown".
 */
export function pageAdAccessFor(connection: PageAdAccessFields | null | undefined): PageAdAccessView {
  const unknown: PageAdAccessView = { status: 'unknown', checkedAt: null, message: null };
  if (!connection?.facebook_page_id) return unknown;
  if (connection.page_ad_access_page_id !== connection.facebook_page_id) return unknown;
  const status = STATUSES.find((s) => s === connection.page_ad_access_status);
  if (!status) return unknown;
  return {
    status,
    checkedAt: connection.page_ad_access_checked_at ?? null,
    message: connection.page_ad_access_error ?? null,
  };
}
