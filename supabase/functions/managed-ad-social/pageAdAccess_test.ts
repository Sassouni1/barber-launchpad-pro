import { assertEquals } from "jsr:@std/assert@1";
import {
  AGENCY_TOKEN_MISSING_CODE,
  AWAITING_TASK_PROOF_MESSAGE,
  BARBER_LAUNCH_BUSINESS_ID,
  CANNOT_VERIFY_MESSAGE,
  checkPageAdAccess,
  createGraphClient,
  grantPageAdAccess,
  isOwnerFieldUnreadable,
  listsBusiness,
  OWNED_UNVERIFIED_MESSAGE,
  PAGE_AD_RETRY_AFTER_MS,
  PARTNER_NO_ADVERTISE_MESSAGE,
  retryPageAdAccess,
  type AgencyNode,
  type GraphResult,
  type PageAccessGraph,
} from "./pageAdAccess.ts";

const PAGE = "1234567890";
const TOKEN = "page-token";

type Calls = { adds: Array<{ pageId: string; businessId: string; tasks: readonly string[] }>; agencyReads: number; ownerReads: number; taskReads: number };
type Tasks = GraphResult<string[] | null>;

function fakeGraph(opts: {
  agencies: Array<GraphResult<AgencyNode[]>>;
  tasks?: Tasks[];
  add?: GraphResult<{ success?: boolean }>;
  owner?: GraphResult<string | null>;
}): { graph: PageAccessGraph; calls: Calls } {
  const calls: Calls = { adds: [], agencyReads: 0, ownerReads: 0, taskReads: 0 };
  const tasks = opts.tasks ?? [notClient];
  const graph: PageAccessGraph = {
    listAgencies: async () => opts.agencies[Math.min(calls.agencyReads++, opts.agencies.length - 1)],
    listClientPageTasks: async () => tasks[Math.min(calls.taskReads++, tasks.length - 1)],
    getPageOwnerBusinessId: async () => {
      calls.ownerReads++;
      return opts.owner ?? { ok: true, data: null };
    },
    addAgency: async (pageId, _token, businessId, t) => {
      calls.adds.push({ pageId, businessId, tasks: t });
      return opts.add ?? { ok: true, data: { success: true } };
    },
  };
  return { graph, calls };
}

const listed: GraphResult<AgencyNode[]> = { ok: true, data: [{ id: BARBER_LAUNCH_BUSINESS_ID, name: "Barber Launch" }] };
const none: GraphResult<AgencyNode[]> = { ok: true, data: [] };
const readFails: GraphResult<AgencyNode[]> = { ok: false, status: 400, error: { code: 100, message: "agencies read failed" } };
const notClient: Tasks = { ok: true, data: null };
const advertise: Tasks = { ok: true, data: ["ADVERTISE", "ANALYZE"] };
const analyzeOnly: Tasks = { ok: true, data: ["ANALYZE"] };
const tokenMissing: Tasks = { ok: false, status: 503, error: { code: AGENCY_TOKEN_MISSING_CODE, message: "missing" } };

Deno.test("only ADVERTISE is requested, for business 1832826473434326, and granted only from client_pages task proof", async () => {
  assertEquals(BARBER_LAUNCH_BUSINESS_ID, "1832826473434326");
  const { graph, calls } = fakeGraph({ agencies: [none, listed], tasks: [notClient, advertise] });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(calls.adds, [{ pageId: PAGE, businessId: "1832826473434326", tasks: ["ADVERTISE"] }]);
  assertEquals(out.status, "granted");
  assertEquals(out.verifiedVia, "client_tasks");
  assertEquals(out.requested, true);
});

Deno.test("an accepted request plus an /agencies listing without task proof is pending, never granted", async () => {
  const out = await checkPageAdAccess(fakeGraph({ agencies: [listed], tasks: [notClient] }).graph, PAGE, TOKEN, true);
  assertEquals(out.status, "pending");
  assertEquals(out.message, AWAITING_TASK_PROOF_MESSAGE);
  assertEquals(out.verifiedVia, undefined);
});

Deno.test("a successful POST that Meta lists but doesn't show ADVERTISE for stays pending", async () => {
  const { graph } = fakeGraph({ agencies: [none, listed], tasks: [notClient, notClient] });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(out.status, "pending");
  assertEquals(out.requested, true);
});

Deno.test("ADVERTISE in client_pages grants even an existing partnership, with no POST", async () => {
  const { graph, calls } = fakeGraph({ agencies: [listed], tasks: [advertise] });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(out.status, "granted");
  assertEquals(out.verifiedVia, "client_tasks");
  assertEquals(calls.adds.length, 0);
});

Deno.test("existing Barber Launch tasks without ADVERTISE are never overwritten by a request", async () => {
  for (const agencies of [listed, none]) {
    const { graph, calls } = fakeGraph({ agencies: [agencies], tasks: [analyzeOnly] });
    const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
    assertEquals(out.status, "unverified");
    assertEquals(out.message, PARTNER_NO_ADVERTISE_MESSAGE);
    assertEquals(calls.adds.length, 0);
  }
});

Deno.test("a partner listing we can't prove tasks for is unverified and never re-requested", async () => {
  const { graph, calls } = fakeGraph({ agencies: [listed], tasks: [notClient] });
  const grant = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(grant.status, "unverified");
  assertEquals(calls.adds.length, 0);
});

Deno.test("without the server token, no request is sent and nothing is granted from a listing", async () => {
  const notListed = fakeGraph({ agencies: [none], tasks: [tokenMissing] });
  const grant = await grantPageAdAccess(notListed.graph, PAGE, TOKEN, false);
  assertEquals(grant.status, "error");
  assertEquals(grant.message, CANNOT_VERIFY_MESSAGE);
  assertEquals(notListed.calls.adds.length, 0);
  const listedPrior = await checkPageAdAccess(fakeGraph({ agencies: [listed], tasks: [tokenMissing] }).graph, PAGE, TOKEN, true);
  assertEquals(listedPrior.status, "pending");
});

Deno.test("a POST without success:true is an error, never granted", async () => {
  const { graph } = fakeGraph({ agencies: [none, listed], tasks: [notClient, advertise], add: { ok: true, data: { success: false } } });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(out.status, "error");
  assertEquals(out.requested, false);
});

Deno.test("Meta permission error is surfaced with Meta's words and is never granted", async () => {
  const { graph } = fakeGraph({
    agencies: [none],
    add: { ok: false, status: 403, error: { code: 200, message: "(#200) Requires pages_manage_metadata permission" } },
  });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(out.status, "error");
  assertEquals(out.metaError?.code, 200);
  assertEquals(out.message?.includes("Requires pages_manage_metadata permission"), true);
});

Deno.test("duplicate-assignment errors (3989, 3946) never count as accepted ADVERTISE", async () => {
  for (const code of [3989, 3946]) {
    const { graph } = fakeGraph({ agencies: [none, listed], add: { ok: false, status: 400, error: { code, message: "dup" } } });
    const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
    assertEquals(out.status, "unverified");
    assertEquals(out.requested, false);
  }
});

Deno.test("a failed agency read sends nothing to Meta and is not granted", async () => {
  const { graph, calls } = fakeGraph({ agencies: [{ ok: false, status: 400, error: { code: 190, message: "expired" } }] });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, true);
  assertEquals(out.status, "error");
  assertEquals(calls.adds.length, 0);
  assertEquals(out.message?.startsWith("Your Facebook login for this Page has expired"), true);
});

Deno.test("a Page owned by Barber Launch is granted from the owner read, without other reads or a POST", async () => {
  const { graph, calls } = fakeGraph({ agencies: [readFails], tasks: [tokenMissing], owner: { ok: true, data: BARBER_LAUNCH_BUSINESS_ID } });
  const out = await checkPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(out.status, "granted");
  assertEquals(out.verifiedVia, "owner");
  assertEquals(calls.agencyReads + calls.taskReads, 0);
  const grant = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(grant.status, "granted");
  assertEquals(calls.adds.length, 0);
});

Deno.test("another business owning the Page is not granted", async () => {
  const out = await checkPageAdAccess(fakeGraph({ agencies: [none], owner: { ok: true, data: "999" } }).graph, PAGE, TOKEN, false);
  assertEquals(out.status, "unknown");
});

Deno.test("a failed owner read with no partner listing sends nothing and is not granted", async () => {
  const { graph, calls } = fakeGraph({ agencies: [none], owner: { ok: false, status: 400, error: { code: 100, message: "owner read failed" } } });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(out.status, "error");
  assertEquals(calls.adds.length, 0);
});

Deno.test("check is read-only", async () => {
  const { graph, calls } = fakeGraph({ agencies: [none] });
  assertEquals((await checkPageAdAccess(graph, PAGE, TOKEN, false)).status, "unknown");
  assertEquals(calls.adds.length, 0);
});

Deno.test("listsBusiness only matches the exact Barber Launch business id", () => {
  assertEquals(listsBusiness([{ id: BARBER_LAUNCH_BUSINESS_ID }]), true);
  assertEquals(listsBusiness([{ id: "999" }, { name: "Barber Launch" }]), false);
});

Deno.test("HTTP adapter: Page reads use the Page token; client_pages uses only the server token", async () => {
  const seen: Array<{ url: URL; auth: string | null }> = [];
  const fetchStub = async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    seen.push({ url, auth: new Headers(init?.headers).get("Authorization") });
    if (url.pathname.endsWith("/agencies")) return new Response(JSON.stringify({ data: [{ id: BARBER_LAUNCH_BUSINESS_ID, name: "BL" }] }), { status: 200 });
    if (url.pathname.endsWith("/client_pages")) {
      return new Response(JSON.stringify({ data: [{ id: "555", permitted_tasks: ["MANAGE"] }, { id: PAGE, permitted_tasks: ["ADVERTISE"] }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: PAGE, business: { id: BARBER_LAUNCH_BUSINESS_ID, name: "BL" } }), { status: 200 });
  };
  const client = createGraphClient("https://graph.facebook.com/v19.0", fetchStub, "server-token");
  assertEquals(await client.listAgencies(PAGE, TOKEN), { ok: true, data: [{ id: BARBER_LAUNCH_BUSINESS_ID, name: "BL" }] });
  assertEquals(await client.getPageOwnerBusinessId(PAGE, TOKEN), { ok: true, data: BARBER_LAUNCH_BUSINESS_ID });
  assertEquals(await client.listClientPageTasks(PAGE), { ok: true, data: ["ADVERTISE"] });
  assertEquals(seen[0].url.searchParams.get("fields"), "id,name");
  assertEquals(seen[1].url.searchParams.get("fields"), "business");
  assertEquals(seen[2].url.pathname, `/v19.0/${BARBER_LAUNCH_BUSINESS_ID}/client_pages`);
  assertEquals(seen[2].url.searchParams.get("fields"), "id,name,permitted_tasks");
  assertEquals(seen[2].auth, "Bearer server-token");
  assertEquals(seen[0].auth, `Bearer ${TOKEN}`);
  assertEquals(seen.some((s) => s.url.searchParams.has("access_token")), false);
});

Deno.test("HTTP adapter: missing server token never reads client_pages and reports it", async () => {
  let calls = 0;
  const client = createGraphClient("https://graph.facebook.com/v19.0", async () => { calls++; return new Response("{}"); }, null);
  const out = await client.listClientPageTasks(PAGE);
  assertEquals(out.ok, false);
  assertEquals(calls, 0);
});

Deno.test("HTTP adapter fails closed when the partner list is longer than it reads", async () => {
  let n = 0;
  const fetchStub = async () =>
    new Response(JSON.stringify({ data: [{ id: String(++n) }], paging: { next: "x", cursors: { after: `c${n}` } } }), { status: 200 });
  const out = await createGraphClient("https://graph.facebook.com/v19.0", fetchStub).listAgencies(PAGE, TOKEN);
  assertEquals(out.ok, false);
});

Deno.test("HTTP adapter POSTs business and only ADVERTISE to /{page-id}/agencies", async () => {
  const seen: Array<{ url: string; method: string; body: string; auth: string | null }> = [];
  const fetchStub = async (input: string | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push({ url: String(input), method: init?.method ?? "GET", body: String(init?.body ?? ""), auth: headers.get("Authorization") });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const client = createGraphClient("https://graph.facebook.com/v19.0", fetchStub, "server-token");
  const out = await client.addAgency(PAGE, TOKEN, BARBER_LAUNCH_BUSINESS_ID, ["ADVERTISE"]);
  assertEquals(out, { ok: true, data: { success: true } });
  assertEquals(seen[0].url, `https://graph.facebook.com/v19.0/${PAGE}/agencies`);
  assertEquals(seen[0].method, "POST");
  const body = new URLSearchParams(seen[0].body);
  assertEquals(body.get("business"), "1832826473434326");
  assertEquals(body.get("permitted_tasks"), '["ADVERTISE"]');
  assertEquals(body.has("access_token"), false);
  // The member's Page token makes the request; the server token is never used for it.
  assertEquals(seen[0].auth, `Bearer ${TOKEN}`);
});

Deno.test("HTTP adapter keeps Meta's error code and message", async () => {
  const fetchStub = async () => new Response(JSON.stringify({ error: { code: 368, message: "blocked" } }), { status: 400 });
  const out = await createGraphClient("https://graph.facebook.com/v19.0", fetchStub).listAgencies(PAGE, TOKEN);
  assertEquals(out, { ok: false, status: 400, error: { code: 368, message: "blocked" } });
});

Deno.test("a pending accepted request is never re-sent by grant or check", async () => {
  const { graph, calls } = fakeGraph({ agencies: [none] });
  assertEquals((await grantPageAdAccess(graph, PAGE, TOKEN, true)).status, "pending");
  assertEquals((await checkPageAdAccess(graph, PAGE, TOKEN, true)).status, "pending");
  assertEquals(calls.adds.length, 0);
});

const ACCEPTED = "2026-11-12T01:00:00.000Z";
const at = (ms: number) => Date.parse(ACCEPTED) + ms;

Deno.test("retry before 15 minutes sends nothing and reads nothing", async () => {
  const { graph, calls } = fakeGraph({ agencies: [none] });
  const out = await retryPageAdAccess(graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS - 1));
  assertEquals(out.status, "pending");
  assertEquals(calls.adds.length + calls.agencyReads + calls.ownerReads + calls.taskReads, 0);
});

Deno.test("retry after 15 minutes resends only ADVERTISE when Barber Launch is still not listed", async () => {
  const { graph, calls } = fakeGraph({ agencies: [none, listed], tasks: [notClient, advertise] });
  const out = await retryPageAdAccess(graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS));
  assertEquals(calls.adds, [{ pageId: PAGE, businessId: BARBER_LAUNCH_BUSINESS_ID, tasks: ["ADVERTISE"] }]);
  assertEquals(out.status, "granted");
  assertEquals(out.requested, true);
});

Deno.test("retry never POSTs when Barber Launch is listed, has tasks, or owns the Page", async () => {
  const listedNow = fakeGraph({ agencies: [listed] });
  assertEquals((await retryPageAdAccess(listedNow.graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS))).status, "pending");
  const hasTasks = fakeGraph({ agencies: [none], tasks: [advertise] });
  assertEquals((await retryPageAdAccess(hasTasks.graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS))).status, "granted");
  const owned = fakeGraph({ agencies: [none], owner: { ok: true, data: BARBER_LAUNCH_BUSINESS_ID } });
  assertEquals((await retryPageAdAccess(owned.graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS))).status, "granted");
  assertEquals(listedNow.calls.adds.length + hasTasks.calls.adds.length + owned.calls.adds.length, 0);
});

Deno.test("retry fails closed on incomplete evidence: failed owner, agency or task read sends nothing", async () => {
  const ownerFails = fakeGraph({ agencies: [none], owner: { ok: false, status: 400, error: { code: 100, message: "x" } } });
  assertEquals((await retryPageAdAccess(ownerFails.graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS))).status, "error");
  const agenciesFail = fakeGraph({ agencies: [readFails] });
  assertEquals((await retryPageAdAccess(agenciesFail.graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS))).status, "error");
  const noToken = fakeGraph({ agencies: [none], tasks: [tokenMissing] });
  assertEquals((await retryPageAdAccess(noToken.graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS))).message, CANNOT_VERIFY_MESSAGE);
  assertEquals(ownerFails.calls.adds.length + agenciesFail.calls.adds.length + noToken.calls.adds.length, 0);
});

Deno.test("retry with no accepted request on record sends nothing", async () => {
  for (const acceptedAt of [null, "not-a-date"]) {
    const { graph, calls } = fakeGraph({ agencies: [none] });
    const out = await retryPageAdAccess(graph, PAGE, TOKEN, acceptedAt, at(PAGE_AD_RETRY_AFTER_MS * 10));
    assertEquals(out.status, "unknown");
    assertEquals(calls.adds.length, 0);
  }
});

// Regression: live Graph rejected fields=owner_business on Chris's Barber Launch Page (2026-11-12).
const OWNER_FIELD_100: GraphResult<string | null> = {
  ok: false,
  status: 400,
  error: { code: 100, message: "(#100) Tried accessing nonexisting field (owner_business)" },
};

Deno.test("(#100) nonexisting owner field is 'unreadable'; token and rate errors are not", () => {
  assertEquals(isOwnerFieldUnreadable(OWNER_FIELD_100.ok ? {} : OWNER_FIELD_100.error), true);
  assertEquals(isOwnerFieldUnreadable({ code: 190, message: "expired" }), false);
  assertEquals(isOwnerFieldUnreadable({ code: 4, message: "rate" }), false);
  assertEquals(isOwnerFieldUnreadable({ code: 100, message: "Invalid parameter" }), false);
});

Deno.test("(#100) owner field + complete agency list without Barber Launch: one ADVERTISE POST, granted only from task proof", async () => {
  const { graph, calls } = fakeGraph({ agencies: [none, listed], tasks: [notClient, advertise], owner: OWNER_FIELD_100 });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(calls.adds, [{ pageId: PAGE, businessId: BARBER_LAUNCH_BUSINESS_ID, tasks: ["ADVERTISE"] }]);
  assertEquals(out.status, "granted");
  assertEquals(out.verifiedVia, "client_tasks");
});

Deno.test("(#100) owner field never grants: no task proof after POST stays pending", async () => {
  const { graph } = fakeGraph({ agencies: [none, listed], owner: OWNER_FIELD_100 });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(out.status, "pending");
  assertEquals(out.verifiedVia, undefined);
});

Deno.test("(#100) owner field + failed agency read sends nothing", async () => {
  const { graph, calls } = fakeGraph({ agencies: [readFails], owner: OWNER_FIELD_100 });
  assertEquals((await grantPageAdAccess(graph, PAGE, TOKEN, false)).status, "error");
  assertEquals(calls.adds.length, 0);
});

Deno.test("already-owned duplicate (3946) with unreadable owner is unverified, never granted", async () => {
  const { graph } = fakeGraph({
    agencies: [none, none],
    owner: OWNER_FIELD_100,
    add: { ok: false, status: 400, error: { code: 3946, message: "already belongs" } },
  });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(out.status, "unverified");
  assertEquals(out.message, OWNED_UNVERIFIED_MESSAGE);
  assertEquals(out.requested, false);
});

Deno.test("Page business read showing Barber Launch is granted via owner with no POST (live shape)", async () => {
  const fetchStub = async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (init?.method === "POST") throw new Error("must not POST");
    if (url.pathname.endsWith("/agencies")) return new Response(JSON.stringify({ data: [{ id: "111", name: "Other" }] }), { status: 200 });
    if (url.searchParams.get("fields") === "business") {
      return new Response(JSON.stringify({ id: PAGE, business: { id: BARBER_LAUNCH_BUSINESS_ID, name: "Invasion Digital Media" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: { code: 100, message: "(#100) Tried accessing nonexisting field (owner_business)" } }), { status: 400 });
  };
  const out = await grantPageAdAccess(createGraphClient("https://graph.facebook.com/v19.0", fetchStub), PAGE, TOKEN, false);
  assertEquals(out.status, "granted");
  assertEquals(out.verifiedVia, "owner");
  assertEquals(out.requested, false);
});
