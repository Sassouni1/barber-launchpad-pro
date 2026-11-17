// Barber Launch advertising access to a member's selected Facebook Page.
// Requests only the ADVERTISE Page task for the Barber Launch business.
//
// What Meta can actually confirm (official docs + live reads):
// - GET /{page-id}?fields=business returns the owning Business (owner_business is rejected live
//   with "(#100) Tried accessing nonexisting field"). An unreadable owner field means ownership is
//   unknown: never granted from it, and it doesn't block a request when the agency list is complete.
// - GET /{business-id}/client_pages?fields=id,name,permitted_tasks, read with Barber Launch's own
//   server token, lists the client Pages Barber Launch has access to and the tasks it has on each.
//   This is the only task proof: "granted" needs ADVERTISE in that list (or Barber Launch owning the Page).
// - GET /{page-id}/agencies returns Business objects (id, name) without tasks. It is used only to
//   avoid sending a request that could overwrite an existing partner's tasks, never as proof.
// - POST /{page-id}/agencies {business, permitted_tasks:['ADVERTISE']} returns success. A success,
//   a listing, or OAuth success alone is never a grant.

export const BARBER_LAUNCH_BUSINESS_ID = '1832826473434326';
/** The only Page task Barber Launch ever requests. */
export const PAGE_AD_TASKS: readonly string[] = Object.freeze(['ADVERTISE']);
/** A member may resend an accepted request only after Meta has had this long to list Barber Launch. */
export const PAGE_AD_RETRY_AFTER_MS = 15 * 60 * 1000;
/** Error code used locally when the server-only Barber Launch token is not configured. */
export const AGENCY_TOKEN_MISSING_CODE = -1;

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
  /** Barber Launch's tasks on this client Page from its own client_pages list; null when the Page isn't listed. */
  listClientPageTasks: (pageId: string) => Promise<GraphResult<string[] | null>>;
  addAgency: (pageId: string, pageToken: string, businessId: string, tasks: readonly string[]) => Promise<GraphResult<{ success?: boolean }>>;
};

export type VerifyOutcome =
  | { state: 'granted'; via: 'owner' | 'client_tasks' }
  /** Barber Launch already has a relationship with this Page that we can't prove includes ADVERTISE. */
  | { state: 'partner_unverified'; reason: 'no_advertise' | 'no_task_proof' }
  /** Meta accepted our ADVERTISE request earlier, but hasn't confirmed the task yet. */
  | { state: 'pending'; reason: 'not_listed' | 'awaiting_task_proof'; canVerify: boolean }
  | { state: 'missing'; canVerify: boolean }
  | { state: 'error'; error: GraphError };

export type AccessOutcome = {
  status: PageAdAccessStatus;
  /** Plain-language explanation for the member; null when access is confirmed or not requested yet. */
  message: string | null;
  /** True only when Meta accepted a new ADVERTISE-only request in this call. */
  requested: boolean;
  /** Which Meta evidence confirmed access; set only when status is "granted". */
  verifiedVia?: 'owner' | 'client_tasks';
  /** Error from the member's own Page token; safe to show the member. */
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

/**
 * True when Meta refused the owner field itself (unsupported/nonexisting field or a permission
 * error), so ownership is unknown. Token, rate-limit and block errors are not included: those fail closed.
 */
export function isOwnerFieldUnreadable(error: GraphError): boolean {
  const code = typeof error.code === 'number' ? error.code : null;
  if (code === 100) return /nonexisting field|unknown field|cannot query field/i.test(error.message ?? '');
  return code === 10 || (code !== null && code >= 200 && code < 300);
}

/** True when GET /{page-id}/agencies lists the Barber Launch business. Says nothing about tasks. */
export function listsBusiness(agencies: AgencyNode[], businessId = BARBER_LAUNCH_BUSINESS_ID): boolean {
  return agencies.some((agency) => agency?.id === businessId);
}

/**
 * Read-only check. Ownership is read first (an owned Page may not list its owner as an agency),
 * then Barber Launch's own client_pages tasks (the only task proof), then the Page's agency list.
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

  const tasks = await graph.listClientPageTasks(pageId);
  if (tasks.ok && Array.isArray(tasks.data) && tasks.data.includes('ADVERTISE')) {
    return { state: 'granted', via: 'client_tasks' };
  }
  // Barber Launch already has tasks on this Page, but not ADVERTISE: never send a request that could change them.
  if (tasks.ok && Array.isArray(tasks.data)) return { state: 'partner_unverified', reason: 'no_advertise' };

  const agencies = await graph.listAgencies(pageId, pageToken);
  if (!agencies.ok) return { state: 'error', error: agencies.error };
  if (listsBusiness(agencies.data)) {
    return priorAccepted
      ? { state: 'pending', reason: 'awaiting_task_proof', canVerify: tasks.ok }
      : { state: 'partner_unverified', reason: 'no_task_proof' };
  }
  // Not listed. An owner field Meta refuses means ownership is unknown, which never grants access
  // but doesn't block a request either. Any other owner read failure stays an error.
  if (!owner.ok && !isOwnerFieldUnreadable(owner.error)) return { state: 'error', error: owner.error };
  return priorAccepted
    ? { state: 'pending', reason: 'not_listed', canVerify: tasks.ok }
    : { state: 'missing', canVerify: tasks.ok };
}

const PENDING_MESSAGE =
  "Facebook accepted the request, but this Page doesn't show Barber Launch as a partner yet. Wait a minute, then press Check again.";

export const AWAITING_TASK_PROOF_MESSAGE =
  "Facebook lists Barber Launch as a partner on this Page, but hasn't confirmed advertising access yet. Wait a minute, then press Check again.";

export const PARTNER_UNVERIFIED_MESSAGE =
  "Barber Launch is already a partner on this Page, but Facebook doesn't show which access it has, so we can't confirm advertising access. " +
  'To fix it, remove Barber Launch from this Page\'s partners in Facebook settings, then press Check again and give access.';

export const PARTNER_NO_ADVERTISE_MESSAGE =
  "Barber Launch is already a partner on this Page, but Facebook shows it without advertising access. We won't change existing access for you. " +
  "To fix it, remove Barber Launch from this Page's partners in Facebook settings, then press Check again and give access.";

export const OWNED_UNVERIFIED_MESSAGE =
  "Facebook says this Page already belongs to Barber Launch's business, but we couldn't read that ownership to confirm it. " +
  'Press Check again in a few minutes.';

export const CANNOT_VERIFY_MESSAGE =
  "Barber Launch can't confirm advertising access with Facebook right now, so no request was sent. Please try again later.";

const RETRY_TOO_SOON_MESSAGE =
  "Facebook accepted the request. If this Page still doesn't list Barber Launch after 15 minutes, you can send it again.";

const metaErrorOf = (error: GraphError) => ({
  code: typeof error.code === 'number' ? error.code : null,
  message: typeof error.message === 'string' ? error.message : null,
});

function fromVerify(current: VerifyOutcome, requested: boolean): AccessOutcome {
  switch (current.state) {
    case 'granted':
      return { status: 'granted', message: null, requested, verifiedVia: current.via };
    case 'partner_unverified':
      return {
        status: 'unverified',
        message: current.reason === 'no_advertise' ? PARTNER_NO_ADVERTISE_MESSAGE : PARTNER_UNVERIFIED_MESSAGE,
        requested,
      };
    case 'pending':
      return { status: 'pending', message: current.reason === 'awaiting_task_proof' ? AWAITING_TASK_PROOF_MESSAGE : PENDING_MESSAGE, requested };
    case 'missing':
      return { status: 'unknown', message: null, requested };
    case 'error':
      return { status: 'error', message: describeGraphError(current.error), requested, metaError: metaErrorOf(current.error) };
  }
}

/** Read-only check (no request is sent to Meta). */
export async function checkPageAdAccess(
  graph: PageAccessGraph,
  pageId: string,
  pageToken: string,
  priorAccepted: boolean,
): Promise<AccessOutcome> {
  return fromVerify(await verifyPageAdAccess(graph, pageId, pageToken, priorAccepted), false);
}

const cannotVerify = (): AccessOutcome => ({ status: 'error', message: CANNOT_VERIFY_MESSAGE, requested: false });

/**
 * Member-initiated grant. Reads first and sends the ADVERTISE-only request only when Barber Launch
 * neither owns, has tasks on, nor is listed on the Page, all reads succeeded, and Barber Launch can
 * verify the result afterwards. An existing relationship is never re-requested, so its tasks are never overwritten.
 */
export async function grantPageAdAccess(
  graph: PageAccessGraph,
  pageId: string,
  pageToken: string,
  priorAccepted: boolean,
): Promise<AccessOutcome> {
  const before = await verifyPageAdAccess(graph, pageId, pageToken, priorAccepted);
  // pending (already accepted earlier) is left alone; resending is a separate, delayed member action.
  if (before.state !== 'missing') return fromVerify(before, false);
  if (!before.canVerify) return cannotVerify();
  return sendAdvertiseRequest(graph, pageId, pageToken, priorAccepted);
}

/**
 * Member-initiated resend after an accepted request still isn't listed by Meta.
 * Requires an accepted request for this Page at least PAGE_AD_RETRY_AFTER_MS old, no Barber Launch
 * ownership, tasks or listing, and complete reads, so an existing partner's tasks can never be changed.
 */
export async function retryPageAdAccess(
  graph: PageAccessGraph,
  pageId: string,
  pageToken: string,
  acceptedAt: string | null,
  now: number = Date.now(),
): Promise<AccessOutcome> {
  const acceptedMs = acceptedAt ? Date.parse(acceptedAt) : NaN;
  if (!Number.isFinite(acceptedMs)) {
    // Nothing accepted to retry: report the current state only.
    return checkPageAdAccess(graph, pageId, pageToken, false);
  }
  if (now - acceptedMs < PAGE_AD_RETRY_AFTER_MS) {
    return { status: 'pending', message: RETRY_TOO_SOON_MESSAGE, requested: false };
  }
  const before = await verifyPageAdAccess(graph, pageId, pageToken, true);
  if (before.state !== 'pending' || before.reason !== 'not_listed') return fromVerify(before, false);
  if (!before.canVerify) return cannotVerify();
  return sendAdvertiseRequest(graph, pageId, pageToken, true);
}

async function sendAdvertiseRequest(
  graph: PageAccessGraph,
  pageId: string,
  pageToken: string,
  priorAccepted: boolean,
): Promise<AccessOutcome> {
  const added = await graph.addAgency(pageId, pageToken, BARBER_LAUNCH_BUSINESS_ID, PAGE_AD_TASKS);
  if (!added.ok) {
    // 3989: already assigned to this agency. 3946: already belongs to this business.
    // Neither says which tasks Barber Launch has, so only a fresh read can decide, without new acceptance.
    if (added.error.code === 3989 || added.error.code === 3946) {
      const after = await verifyPageAdAccess(graph, pageId, pageToken, priorAccepted);
      if (after.state === 'missing' || after.state === 'pending') {
        const message = added.error.code === 3946 ? OWNED_UNVERIFIED_MESSAGE : PARTNER_UNVERIFIED_MESSAGE;
        return { status: 'unverified', message, requested: false, metaError: metaErrorOf(added.error) };
      }
      return fromVerify(after, false);
    }
    return { status: 'error', message: describeGraphError(added.error), requested: false, metaError: metaErrorOf(added.error) };
  }
  if (added.data?.success !== true) {
    return { status: 'error', message: "Facebook didn't accept the advertising access request. Please try again.", requested: false };
  }

  // Meta accepted an ADVERTISE-only request for this Page; only Barber Launch's task list can confirm it.
  const after = await verifyPageAdAccess(graph, pageId, pageToken, true);
  if (after.state === 'error') {
    return {
      status: 'pending',
      message: `Facebook accepted the request, but we couldn't confirm it yet. ${describeGraphError(after.error)}`,
      requested: true,
      metaError: metaErrorOf(after.error),
    };
  }
  return fromVerify(after, true);
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

async function fetchGraph<T>(fetchImpl: FetchLike, url: string | URL, init: RequestInit | undefined, pick: (p: Record<string, unknown>) => T): Promise<GraphResult<T>> {
  try {
    return await readGraph(await fetchImpl(url, init), pick);
  } catch {
    return { ok: false, status: 0, error: { message: 'Could not reach Facebook.' } };
  }
}

/**
 * Real Graph API adapter. Tokens travel only in the Authorization header.
 * `agencyToken` is Barber Launch's server-only token, used only for its own client_pages list.
 */
export function createGraphClient(graphBase: string, fetchImpl: FetchLike = fetch, agencyToken?: string | null): PageAccessGraph {
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  return {
    async listAgencies(pageId, pageToken) {
      const all: AgencyNode[] = [];
      let after: string | undefined;
      for (let i = 0; i < 5; i++) {
        const url = new URL(`${graphBase}/${pageId}/agencies`);
        // Business objects only define id/name here; tasks and request status are not returned.
        url.searchParams.set('fields', 'id,name');
        url.searchParams.set('limit', '100');
        if (after) url.searchParams.set('after', after);
        const result = await fetchGraph(fetchImpl, url, { headers: auth(pageToken) }, (p) => p);
        if (!result.ok) return result;
        const data = result.data.data;
        if (!Array.isArray(data)) return { ok: false, status: 502, error: { message: 'Facebook returned an invalid agency list.' } };
        all.push(...data as AgencyNode[]);
        const paging = result.data.paging as { next?: string; cursors?: { after?: string } } | undefined;
        const nextAfter = paging?.cursors?.after;
        if (!paging?.next || typeof nextAfter !== 'string' || nextAfter === after) return { ok: true, data: all };
        after = nextAfter;
      }
      // Never decide from a partial list.
      return { ok: false, status: 502, error: { message: 'Facebook returned too many partners to check.' } };
    },
    async getPageOwnerBusinessId(pageId, pageToken) {
      const url = new URL(`${graphBase}/${pageId}`);
      // business is the Page's owning Business; verified live. owner_business is rejected with (#100).
      url.searchParams.set('fields', 'business');
      return fetchGraph(fetchImpl, url, { headers: auth(pageToken) }, (p) => {
        const owner = p.business as { id?: unknown } | undefined;
        return typeof owner?.id === 'string' ? owner.id : null;
      });
    },
    async listClientPageTasks(pageId) {
      if (!agencyToken) {
        return { ok: false, status: 503, error: { code: AGENCY_TOKEN_MISSING_CODE, message: 'Barber Launch server Meta token is not configured.' } };
      }
      let after: string | undefined;
      for (let i = 0; i < 20; i++) {
        const url = new URL(`${graphBase}/${BARBER_LAUNCH_BUSINESS_ID}/client_pages`);
        url.searchParams.set('fields', 'id,name,permitted_tasks');
        url.searchParams.set('limit', '100');
        if (after) url.searchParams.set('after', after);
        const result = await fetchGraph(fetchImpl, url, { headers: auth(agencyToken) }, (p) => p);
        if (!result.ok) return result;
        const data = result.data.data;
        if (!Array.isArray(data)) return { ok: false, status: 502, error: { message: 'Facebook returned an invalid client Page list.' } };
        const match = (data as Array<{ id?: unknown; permitted_tasks?: unknown }>).find((p) => p?.id === pageId);
        if (match) {
          const tasks = Array.isArray(match.permitted_tasks) ? match.permitted_tasks.filter((t): t is string => typeof t === 'string') : [];
          return { ok: true, data: tasks };
        }
        const paging = result.data.paging as { next?: string; cursors?: { after?: string } } | undefined;
        const nextAfter = paging?.cursors?.after;
        if (!paging?.next || typeof nextAfter !== 'string' || nextAfter === after) return { ok: true, data: null };
        after = nextAfter;
      }
      return { ok: false, status: 502, error: { message: 'Facebook returned too many client Pages to check.' } };
    },
    async addAgency(pageId, pageToken, businessId, tasks) {
      const body = new URLSearchParams({ business: businessId, permitted_tasks: JSON.stringify(tasks) });
      return fetchGraph(fetchImpl, `${graphBase}/${pageId}/agencies`, {
        method: 'POST',
        headers: { ...auth(pageToken), 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }, (p) => ({ success: p.success === true }));
    },
  };
}

/** Sanitized result of one read-only Graph field read, for the ownership probe. */
export type ProbeRead =
  | { ok: true; businessId: string | null; businessName: string | null }
  | { ok: false; status: number; code: number | null; message: string | null };

/**
 * Read-only diagnostic: which Page ownership fields does the live Graph endpoint accept for
 * this member's Page token, and what does Barber Launch's client_pages list show? Returns only
 * business ids/names, task names and Meta error codes, never tokens.
 */
export async function probePageOwnership(
  graphBase: string,
  pageId: string,
  pageToken: string,
  fetchImpl: FetchLike = fetch,
  agencyToken?: string | null,
) {
  const fields: Record<string, ProbeRead> = {};
  for (const field of ['business', 'owner_business']) {
    const url = new URL(`${graphBase}/${pageId}`);
    url.searchParams.set('fields', field);
    const res = await fetchGraph(
      fetchImpl, url, { headers: { Authorization: `Bearer ${pageToken}` } },
      (p) => p[field] as { id?: unknown; name?: unknown } | undefined,
    );
    fields[field] = res.ok
      ? {
        ok: true,
        businessId: typeof res.data?.id === 'string' ? res.data.id : null,
        businessName: typeof res.data?.name === 'string' ? res.data.name : null,
      }
      : { ok: false, status: res.status, ...metaErrorOf(res.error) };
  }
  const client = createGraphClient(graphBase, fetchImpl, agencyToken);
  const list = await client.listAgencies(pageId, pageToken);
  const agencies = list.ok
    ? { ok: true, count: list.data.length, listsBarberLaunch: listsBusiness(list.data), code: null, message: null }
    : { ok: false, count: null, listsBarberLaunch: null, ...metaErrorOf(list.error) };
  const tasks = await client.listClientPageTasks(pageId);
  const clientTasks = tasks.ok
    ? { ok: true, listed: tasks.data !== null, tasks: tasks.data, code: null, message: null }
    : { ok: false, listed: null, tasks: null, ...metaErrorOf(tasks.error) };
  return { fields, agencies, clientTasks };
}
