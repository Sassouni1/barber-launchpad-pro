import { assertEquals } from "jsr:@std/assert@1";
import {
  BARBER_LAUNCH_BUSINESS_ID,
  checkPageAdAccess,
  classifyAgencies,
  createGraphClient,
  grantPageAdAccess,
  type AgencyNode,
  type GraphResult,
  type PageAccessGraph,
} from "./pageAdAccess.ts";

const PAGE = "1234567890";
const TOKEN = "page-token";

type Calls = { adds: Array<{ pageId: string; businessId: string; tasks: readonly string[] }>; reads: number };

function fakeGraph(opts: {
  reads: Array<GraphResult<AgencyNode[]>>;
  add?: GraphResult<{ success?: boolean }>;
  owner?: string | null;
}): { graph: PageAccessGraph; calls: Calls } {
  const calls: Calls = { adds: [], reads: 0 };
  const graph: PageAccessGraph = {
    listAgencies: async () => opts.reads[Math.min(calls.reads++, opts.reads.length - 1)],
    getPageOwnerBusinessId: async () => ({ ok: true, data: opts.owner ?? null }),
    addAgency: async (pageId, _token, businessId, tasks) => {
      calls.adds.push({ pageId, businessId, tasks });
      return opts.add ?? { ok: true, data: { success: true } };
    },
  };
  return { graph, calls };
}

const confirmed: GraphResult<AgencyNode[]> = {
  ok: true,
  data: [{ id: BARBER_LAUNCH_BUSINESS_ID, access_status: "CONFIRMED", permitted_tasks: ["ADVERTISE"] }],
};
const none: GraphResult<AgencyNode[]> = { ok: true, data: [] };
const pending: GraphResult<AgencyNode[]> = {
  ok: true,
  data: [{ id: BARBER_LAUNCH_BUSINESS_ID, access_status: "PENDING", permitted_tasks: ["ADVERTISE"] }],
};

Deno.test("Barber Launch business id is 1832826473434326 and only ADVERTISE is requested", async () => {
  assertEquals(BARBER_LAUNCH_BUSINESS_ID, "1832826473434326");
  const { graph, calls } = fakeGraph({ reads: [none, confirmed] });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN);
  assertEquals(calls.adds, [{ pageId: PAGE, businessId: "1832826473434326", tasks: ["ADVERTISE"] }]);
  assertEquals(out.status, "granted");
  assertEquals(out.requested, true);
});

Deno.test("already granted access is idempotent: no new request is sent", async () => {
  const { graph, calls } = fakeGraph({ reads: [confirmed] });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN);
  assertEquals(out.status, "granted");
  assertEquals(calls.adds.length, 0);
});

Deno.test("an existing pending request is not re-sent and stays pending", async () => {
  const { graph, calls } = fakeGraph({ reads: [pending] });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN);
  assertEquals(out.status, "pending");
  assertEquals(calls.adds.length, 0);
});

Deno.test("a successful POST is not 'granted' until a read confirms it", async () => {
  const { graph } = fakeGraph({ reads: [none, none] });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN);
  assertEquals(out.status, "pending");
  assertEquals(out.requested, true);
});

Deno.test("Meta permission error is surfaced with Meta's words and is never granted", async () => {
  const { graph } = fakeGraph({
    reads: [none],
    add: { ok: false, status: 403, error: { code: 200, message: "(#200) Requires pages_manage_metadata permission" } },
  });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN);
  assertEquals(out.status, "error");
  assertEquals(out.metaError?.code, 200);
  assertEquals(out.message?.includes("Requires pages_manage_metadata permission"), true);
});

Deno.test("duplicate-asset errors (3989, 3946) fall through to a confirming read", async () => {
  for (const code of [3989, 3946]) {
    const { graph } = fakeGraph({ reads: [none, confirmed], add: { ok: false, status: 400, error: { code, message: "dup" } } });
    const out = await grantPageAdAccess(graph, PAGE, TOKEN);
    assertEquals(out.status, "granted");
    assertEquals(out.requested, false);
  }
});

Deno.test("a failed first read sends nothing to Meta", async () => {
  const { graph, calls } = fakeGraph({ reads: [{ ok: false, status: 400, error: { code: 190, message: "expired" } }] });
  const out = await grantPageAdAccess(graph, PAGE, TOKEN);
  assertEquals(out.status, "error");
  assertEquals(calls.adds.length, 0);
  assertEquals(out.message?.startsWith("Your Facebook login for this Page has expired"), true);
});

Deno.test("confirmed without ADVERTISE, or unconfirmed ADVERTISE, is never granted", () => {
  assertEquals(classifyAgencies([{ id: BARBER_LAUNCH_BUSINESS_ID, access_status: "CONFIRMED", permitted_tasks: ["ANALYZE"] }]), "missing");
  assertEquals(classifyAgencies([{ id: BARBER_LAUNCH_BUSINESS_ID, permitted_tasks: ["ADVERTISE"] }]), "pending");
  assertEquals(classifyAgencies([{ id: "999", access_status: "CONFIRMED", permitted_tasks: ["ADVERTISE"] }]), "missing");
});

Deno.test("a Page owned by the Barber Launch business counts as granted via a read", async () => {
  const { graph, calls } = fakeGraph({ reads: [none], owner: BARBER_LAUNCH_BUSINESS_ID });
  const out = await checkPageAdAccess(graph, PAGE, TOKEN);
  assertEquals(out.status, "granted");
  assertEquals(calls.adds.length, 0);
});

Deno.test("check is read-only", async () => {
  const { graph, calls } = fakeGraph({ reads: [none] });
  const out = await checkPageAdAccess(graph, PAGE, TOKEN);
  assertEquals(out.status, "unknown");
  assertEquals(calls.adds.length, 0);
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
