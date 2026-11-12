import { assertEquals } from "jsr:@std/assert@1";
import {
  BARBER_LAUNCH_BUSINESS_ID,
  checkPageAdAccess,
  createGraphClient,
  grantPageAdAccess,
  listsBusiness,
  PAGE_AD_RETRY_AFTER_MS,
  retryPageAdAccess,
  type AgencyNode,
  type GraphResult,
  type PageAccessGraph,
} from "./pageAdAccess.ts";

const PAGE = "1234567890";
const TOKEN = "page-token";

type Calls = { adds: Array<{ pageId: string; businessId: string; tasks: readonly string[] }>; agencyReads: number; ownerReads: number };

function fakeGraph(opts: {
  agencies: Array<GraphResult<AgencyNode[]>>;
  add?: GraphResult<{ success?: boolean }>;
  owner?: GraphResult<string | null>;
}): { graph: PageAccessGraph; calls: Calls } {
  const calls: Calls = { adds: [], agencyReads: 0, ownerReads: 0 };
  const graph: PageAccessGraph = {
    listAgencies: async () => opts.agencies[Math.min(calls.agencyReads++, opts.agencies.length - 1)],
    getPageOwnerBusinessId: async () => {
      calls.ownerReads++;
      return opts.owner ?? { ok: true, data: null };
    },
    addAgency: async (pageId, _token, businessId, tasks) => {
      calls.adds.push({ pageId, businessId, tasks });
      return opts.add ?? { ok: true, data: { success: true } };
    },
  };
  return { graph, calls };
}

const listed: GraphResult<AgencyNode[]> = { ok: true, data: [{ id: BARBER_LAUNCH_BUSINESS_ID, name: "Barber Launch" }] };
const none: GraphResult<AgencyNode[]> = { ok: true, data: [] };
const readFails: GraphResult<AgencyNode[]> = { ok: false, status: 400, error: { code: 100, message: "agencies read failed" } };

Deno.test("Barber Launch business id is 1832826473434326 and only ADVERTISE is requested", async () => {
  assertEquals(BARBER_LAUNCH_BUSINESS_ID, "1832826473434326");
  const { graph, calls } = fakeGraph({ agencies: [none, listed] });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(calls.adds, [{ pageId: PAGE, businessId: "1832826473434326", tasks: ["ADVERTISE"] }]);
  assertEquals(out.status, "granted");
  assertEquals(out.verifiedVia, "agency");
  assertEquals(out.requested, true);
});

Deno.test("accepted ADVERTISE request is granted on a later check only while the Page lists Barber Launch", async () => {
  const listedNow = await checkPageAdAccess(fakeGraph({ agencies: [listed] }).graph, PAGE, TOKEN, true);
  assertEquals(listedNow.status, "granted");
  const notListed = await checkPageAdAccess(fakeGraph({ agencies: [none] }).graph, PAGE, TOKEN, true);
  assertEquals(notListed.status, "pending");
});

Deno.test("a partner listing we didn't create is unverified, never granted, and never re-requested", async () => {
  const check = await checkPageAdAccess(fakeGraph({ agencies: [listed] }).graph, PAGE, TOKEN, false);
  assertEquals(check.status, "unverified");
  const { graph, calls } = fakeGraph({ agencies: [listed] });
  const grant = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(grant.status, "unverified");
  assertEquals(calls.adds.length, 0);
});

Deno.test("a successful POST is not 'granted' until the Page lists Barber Launch", async () => {
  const { graph } = fakeGraph({ agencies: [none, none] });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(out.status, "pending");
  assertEquals(out.requested, true);
});

Deno.test("a POST without success:true is an error, never granted", async () => {
  const { graph } = fakeGraph({ agencies: [none, listed], add: { ok: true, data: { success: false } } });
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

Deno.test("a Page owned by Barber Launch is granted from the owner read, even when the agency read fails", async () => {
  const { graph, calls } = fakeGraph({ agencies: [readFails], owner: { ok: true, data: BARBER_LAUNCH_BUSINESS_ID } });
  const out = await checkPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(out.status, "granted");
  assertEquals(out.verifiedVia, "owner");
  assertEquals(calls.agencyReads, 0);
  const grant = await grantPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(grant.status, "granted");
  assertEquals(calls.adds.length, 0);
});

Deno.test("another business owning the Page is not granted", async () => {
  const { graph } = fakeGraph({ agencies: [none], owner: { ok: true, data: "999" } });
  const out = await checkPageAdAccess(graph, PAGE, TOKEN, false);
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
  const out = await checkPageAdAccess(graph, PAGE, TOKEN, false);
  assertEquals(out.status, "unknown");
  assertEquals(calls.adds.length, 0);
});

Deno.test("listsBusiness only matches the exact Barber Launch business id", () => {
  assertEquals(listsBusiness([{ id: BARBER_LAUNCH_BUSINESS_ID }]), true);
  assertEquals(listsBusiness([{ id: "999" }, { name: "Barber Launch" }]), false);
});

Deno.test("HTTP adapter reads only supported fields: agencies id,name and Page owner_business", async () => {
  const urls: string[] = [];
  const fetchStub = async (input: string | URL) => {
    urls.push(String(input));
    const url = new URL(String(input));
    if (url.pathname.endsWith("/agencies")) return new Response(JSON.stringify({ data: [{ id: BARBER_LAUNCH_BUSINESS_ID, name: "BL" }] }), { status: 200 });
    return new Response(JSON.stringify({ id: PAGE, owner_business: { id: BARBER_LAUNCH_BUSINESS_ID, name: "BL" } }), { status: 200 });
  };
  const client = createGraphClient("https://graph.facebook.com/v19.0", fetchStub);
  assertEquals(await client.listAgencies(PAGE, TOKEN), { ok: true, data: [{ id: BARBER_LAUNCH_BUSINESS_ID, name: "BL" }] });
  assertEquals(await client.getPageOwnerBusinessId(PAGE, TOKEN), { ok: true, data: BARBER_LAUNCH_BUSINESS_ID });
  assertEquals(new URL(urls[0]).searchParams.get("fields"), "id,name");
  assertEquals(new URL(urls[1]).searchParams.get("fields"), "owner_business");
  assertEquals(urls.some((u) => u.includes("access_status") || u.includes("permitted_tasks")), false);
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
  const client = createGraphClient("https://graph.facebook.com/v19.0", fetchStub);
  const out = await client.addAgency(PAGE, TOKEN, BARBER_LAUNCH_BUSINESS_ID, ["ADVERTISE"]);
  assertEquals(out, { ok: true, data: { success: true } });
  assertEquals(seen[0].url, `https://graph.facebook.com/v19.0/${PAGE}/agencies`);
  assertEquals(seen[0].method, "POST");
  const body = new URLSearchParams(seen[0].body);
  assertEquals(body.get("business"), "1832826473434326");
  assertEquals(body.get("permitted_tasks"), '["ADVERTISE"]');
  assertEquals(body.has("access_token"), false);
  assertEquals(seen[0].auth, `Bearer ${TOKEN}`);
});

Deno.test("HTTP adapter keeps Meta's error code and message", async () => {
  const fetchStub = async () =>
    new Response(JSON.stringify({ error: { code: 368, message: "blocked" } }), { status: 400 });
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
  assertEquals(calls.adds.length + calls.agencyReads + calls.ownerReads, 0);
});

Deno.test("retry after 15 minutes resends only ADVERTISE when Barber Launch is still not listed", async () => {
  const { graph, calls } = fakeGraph({ agencies: [none, listed] });
  const out = await retryPageAdAccess(graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS));
  assertEquals(calls.adds, [{ pageId: PAGE, businessId: BARBER_LAUNCH_BUSINESS_ID, tasks: ["ADVERTISE"] }]);
  assertEquals(out.status, "granted");
  assertEquals(out.requested, true);
});

Deno.test("retry never POSTs when Barber Launch is listed or owns the Page", async () => {
  const listedNow = fakeGraph({ agencies: [listed] });
  assertEquals((await retryPageAdAccess(listedNow.graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS))).status, "granted");
  const owned = fakeGraph({ agencies: [none], owner: { ok: true, data: BARBER_LAUNCH_BUSINESS_ID } });
  assertEquals((await retryPageAdAccess(owned.graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS))).status, "granted");
  assertEquals(listedNow.calls.adds.length + owned.calls.adds.length, 0);
});

Deno.test("retry fails closed on incomplete evidence: failed owner or agency read sends nothing", async () => {
  const ownerFails = fakeGraph({ agencies: [none], owner: { ok: false, status: 400, error: { code: 100, message: "x" } } });
  assertEquals((await retryPageAdAccess(ownerFails.graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS))).status, "error");
  const agenciesFail = fakeGraph({ agencies: [readFails] });
  assertEquals((await retryPageAdAccess(agenciesFail.graph, PAGE, TOKEN, ACCEPTED, at(PAGE_AD_RETRY_AFTER_MS))).status, "error");
  assertEquals(ownerFails.calls.adds.length + agenciesFail.calls.adds.length, 0);
});

Deno.test("retry with no accepted request on record sends nothing", async () => {
  for (const acceptedAt of [null, "not-a-date"]) {
    const { graph, calls } = fakeGraph({ agencies: [none] });
    const out = await retryPageAdAccess(graph, PAGE, TOKEN, acceptedAt, at(PAGE_AD_RETRY_AFTER_MS * 10));
    assertEquals(out.status, "unknown");
    assertEquals(calls.adds.length, 0);
  }
});
