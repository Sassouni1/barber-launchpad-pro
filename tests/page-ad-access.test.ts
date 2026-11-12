import { describe, it, expect } from 'bun:test';
import { pageAdAccessFor } from '../src/lib/pageAdAccess';

const base = {
  facebook_page_id: '111',
  page_ad_access_status: 'granted',
  page_ad_access_page_id: '111',
  page_ad_access_checked_at: '2026-11-12T01:00:00.000Z',
  page_ad_access_error: null,
};

describe('pageAdAccessFor', () => {
  it('shows granted only for the Page it was checked against', () => {
    expect(pageAdAccessFor(base).status).toBe('granted');
    expect(pageAdAccessFor({ ...base, facebook_page_id: '222' }).status).toBe('unknown');
  });

  it('treats rows from before the access columns existed as unknown, not granted', () => {
    expect(pageAdAccessFor({ facebook_page_id: '111' }).status).toBe('unknown');
  });

  it('treats an unrecognised status as unknown', () => {
    expect(pageAdAccessFor({ ...base, page_ad_access_status: 'ready' }).status).toBe('unknown');
  });

  it('keeps the saved Meta explanation for errors', () => {
    const view = pageAdAccessFor({ ...base, page_ad_access_status: 'error', page_ad_access_error: 'Meta said: "x"' });
    expect(view).toEqual({ status: 'error', checkedAt: base.page_ad_access_checked_at, message: 'Meta said: "x"' });
  });
});
