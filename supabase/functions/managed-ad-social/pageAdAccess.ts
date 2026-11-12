// Barber Launch advertising access to a member's selected Facebook Page.
// Requests only the ADVERTISE Page task for the Barber Launch business.
//
// What Meta can actually confirm (official Business SDK):
// - GET /{page-id}?fields=owner_business returns the owning Business.
// - GET /{page-id}/agencies returns Business objects (id, name). It does NOT return
//   permitted tasks or a request status, so a listing alone never proves ADVERTISE.
// - POST /{page-id}/agencies {business, permitted_tasks:['ADVERTISE']} returns success.
// "granted" therefore means either Barber Launch owns the Page, or Meta accepted our
// ADVERTISE-only request for this exact Page and the Page currently lists Barber Launch
// as a partner. A partner listing we did not create is "unverified", never granted.

export const BARBER_LAUNCH_BUSINESS_ID = '1832826473434326';
/** The only Page task Barber Launch ever requests. */
export const PAGE_AD_TASKS: readonly string[] = Object.freeze(['ADVERTISE']);

export type PageAdAccessStatus = 'unknown' | 'pending' | 'unverified' | 'granted' | 'error';

export type GraphError = {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  error_user_title?: string;
};

export type GraphResult<T> = { ok: true; data: T } | { ok: false; status: number; error: GraphError };

/** GET /{page-id}/agencies returns Business objects; only id and name are requested. */
export type AgencyNode = { id?: string; name?: string };

export type PageAccessGraph = {
  listAgencies: (pageId: string, pageToken: string) => Promise<GraphResult<AgencyNode[]>>;
  getPageOwnerBusinessId: (pageId: string, pageToken: string) => Promise<GraphResult<string | null>>;
  addAgency: (pageId: string, pageToken: string, businessId: string, tasks: readonly string[]) => Promise<GraphResult<{ success?: boolean }>>;
};

export type VerifyOutcome =
  | { state: 'granted'; via: 'owner' | 'agency' }
  /** Listed as a partner, but Meta doesn't show its tasks and we have no accepted ADVERTISE request on record. */
  | { state: 'partner_unverified' }
  /** Meta accepted our ADVERTISE request earlier, but the Page doesn't list Barber Launch yet. */
  | { state: 'pending' }
  | { state: 'missing' }
  | { state: 'error'; error: GraphError };

export type AccessOutcome = {
  status: PageAdAccessStatus;
  /** Plain-language explanation for the member; null when access is confirmed or not requested yet. */
  message: string | null;
  /** True only when Meta accepted a new ADVERTISE-only request in this call. */
  requested: boolean;
  /** Which Meta evidence confirmed access; set only when status is "granted". */
  verifiedVia?: 'owner' | 'agency';
  metaError?: { code: number | null; message: string | null };
};

export const isFacebookId = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{1,32}$/.test(value);

const metaSaid = (error: GraphError) => {
  const text = (error.error_user_msg || error.message || '').trim();
  return text ? ` Meta said: "${text}"` : '';
};

/** Turns a Graph API error into a plain-language sentence, keeping Meta's own words. */
export function describeGraphError(error: GraphError): string {
  const code = typeof error.code === 'number' ? error.code : null;
  if (code === 190) {
    return 'Your Facebook login for this Page has expired. Reconnect Facebook, choose your Page again, then try again.';
  }
  if (code !== null && [4, 17, 32, 613, 80001].includes(code)) {
    return 'Facebook is limiting requests right now. Wait a few minutes, then try again.';
  }
  if (code === 10 || (code !== null && code >= 200 && code < 300)) {
    return `Facebook needs extra permission before Barber Launch can get advertising access to this Page.${metaSaid(error)}`;
  }
  if (code === 368) {
    return `Facebook blocked this request for now.${metaSaid(error)}`;
  }
  return `Facebook couldn't confirm advertising access for this Page.${metaSaid(error)}`;
}

/** True when GET /{page-id}/agencies lists the Barber Launch business. Says nothing about tasks. */
export function listsBusiness(agencies: AgencyNode[], businessId = BARBER_LAUNCH_BUSINESS_ID): boolean {
  return agencies.some((agency) => agency?.id === businessId);
}

/**
 * Read-only check. Ownership is read first, because a Page Barber Launch owns may not
 * list Barber Launch as its own agency and that must not depend on the agency read.
 * `priorAccepted` is true only when Meta accepted our ADVERTISE request for this Page earlier.
 */
export async function verifyPageAdAccess(
  graph: PageAccessGraph,
  pageId: string,
  pageToken: string,
  priorAccepted: boolean,
): Promise<VerifyOutcome> {
  const owner = await graph.getPageOwnerBusinessId(pageId, pageToken);
  if (owner.ok && owner.data === BARBER_LAUNCH_BUSINESS_ID) return { state: 'granted', via: 'owner' };

  const agencies = await graph.listAgencies(pageId, pageToken);
  if (!agencies.ok) return { state: 'error', error: agencies.error };
  if (listsBusiness(agencies.data)) {
    return priorAccepted ? { state: 'granted', via: 'agency' } : { state: 'partner_unverified' };
  }
  // Not listed. Without a working owner read we can't rule out ownership, so stay unverified.
  if (!owner.ok) return { state: 'error', error: owner.error };
  return priorAccepted ? { state: 'pending' } : { state: 'missing' };
}

const PENDING_MESSAGE =
  "Request sent. Meta hasn't confirmed it yet. If Facebook asks you to approve Barber Launch, approve it, then press Check again.";

const metaErrorOf = (error: GraphError) => ({
  code: typeof error.code === 'number' ? error.code : null,
  message: typeof error.message === 'string' ? error.message : null,
});

/** Read-only check (no request is sent to Meta). */
export async function checkPageAdAccess(graph: PageAccessGraph, pageId: string, pageToken: string): Promise<AccessOutcome> {
  const current = await verifyPageAdAccess(graph, pageId, pageToken);
  if (current.state === 'granted') return { status: 'granted', message: null, requested: false };
  if (current.state === 'pending') return { status: 'pending', message: PENDING_MESSAGE, requested: false };
  if (current.state === 'missing') {
    return { status: 'unknown', message: "Barber Launch doesn't have advertising access to this Page yet.", requested: false };
  }
  return { status: 'error', message: describeGraphError(current.error), requested: false, metaError: metaErrorOf(current.error) };
}

/**
 * Idempotent grant: read first, request ADVERTISE only when Barber Launch has no
 * access or request yet, then read again. Only a confirmed read returns "granted".
 */
export async function grantPageAdAccess(graph: PageAccessGraph, pageId: string, pageToken: string): Promise<AccessOutcome> {
  const before = await verifyPageAdAccess(graph, pageId, pageToken);
  if (before.state === 'granted') return { status: 'granted', message: null, requested: false };
  if (before.state === 'pending') return { status: 'pending', message: PENDING_MESSAGE, requested: false };
  if (before.state === 'error') {
    // Without a working read we cannot avoid duplicates or confirm anything, so send nothing.
    return { status: 'error', message: describeGraphError(before.error), requested: false, metaError: metaErrorOf(before.error) };
  }

  const added = await graph.addAgency(pageId, pageToken, BARBER_LAUNCH_BUSINESS_ID, PAGE_AD_TASKS);
  let requested = false;
  if (!added.ok) {
    // 3989: already assigned to this agency. 3946: already belongs to this business.
    const alreadyThere = added.error.code === 3989 || added.error.code === 3946;
    if (!alreadyThere) {
      return { status: 'error', message: describeGraphError(added.error), requested: false, metaError: metaErrorOf(added.error) };
    }
  } else if (added.data?.success !== true) {
    return { status: 'error', message: "Facebook didn't accept the advertising access request. Please try again.", requested: false };
  } else {
    requested = true;
  }

  const after = await verifyPageAdAccess(graph, pageId, pageToken);
  if (after.state === 'granted') return { status: 'granted', message: null, requested };
  if (after.state === 'error') {
    return {
      status: 'pending',
      message: `Request sent, but we couldn't confirm it with Facebook yet. ${describeGraphError(after.error)}`,
      requested,
      metaError: metaErrorOf(after.error),
    };
  }
  return { status: 'pending', message: PENDING_MESSAGE, requested };
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

async function readGraph<T>(res: Response, pick: (payload: Record<string, unknown>) => T): Promise<GraphResult<T>> {
  const payload = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!res.ok || !payload || payload.error) {
    const error = (payload?.error && typeof payload.error === 'object' ? payload.error : {}) as GraphError;
    return { ok: false, status: res.status, error: { ...error, message: error.message ?? `Facebook returned HTTP ${res.status}` } };
  }
  return { ok: true, data: pick(payload) };
}

/** Real Graph API adapter. Tokens travel only in the Authorization header. */
export function createGraphClient(graphBase: string, fetchImpl: FetchLike = fetch): PageAccessGraph {
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  return {
    async listAgencies(pageId, pageToken) {
      const all: AgencyNode[] = [];
      let after: string | undefined;
      for (let i = 0; i < 5; i++) {
        const url = new URL(`${graphBase}/${pageId}/agencies`);
        url.searchParams.set('fields', 'id,name,access_status,permitted_tasks');
        url.searchParams.set('limit', '100');
        if (after) url.searchParams.set('after', after);
        const result = await readGraph(await fetchImpl(url, { headers: auth(pageToken) }), (p) => p);
        if (!result.ok) return result;
        const data = result.data.data;
        if (!Array.isArray(data)) return { ok: false, status: 502, error: { message: 'Facebook returned an invalid agency list.' } };
        all.push(...data as AgencyNode[]);
        const paging = result.data.paging as { next?: string; cursors?: { after?: string } } | undefined;
        const nextAfter = paging?.cursors?.after;
        if (!paging?.next || typeof nextAfter !== 'string' || nextAfter === after) return { ok: true, data: all };
        after = nextAfter;
      }
      return { ok: true, data: all };
    },
    async getPageOwnerBusinessId(pageId, pageToken) {
      const url = new URL(`${graphBase}/${pageId}`);
      url.searchParams.set('fields', 'business');
      return readGraph(await fetchImpl(url, { headers: auth(pageToken) }), (p) => {
        const business = p.business as { id?: unknown } | undefined;
        return typeof business?.id === 'string' ? business.id : null;
      });
    },
    async addAgency(pageId, pageToken, businessId, tasks) {
      const body = new URLSearchParams({ business: businessId, permitted_tasks: JSON.stringify(tasks) });
      const res = await fetchImpl(`${graphBase}/${pageId}/agencies`, {
        method: 'POST',
        headers: { ...auth(pageToken), 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      return readGraph(res, (p) => ({ success: p.success === true }));
    },
  };
}
