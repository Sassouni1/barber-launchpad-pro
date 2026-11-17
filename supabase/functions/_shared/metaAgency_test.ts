import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID,
  buildPausedCampaignBody,
  checkOfficialCampaign,
  countLeads,
  createAgencyClient,
  deliveryState,
  insightsBelongTo,
  normalizeAgencyToken,
  agencyTokenProblem,
  parseSpecialAdDeclaration,
  summarizeInsight,
  type MetaCampaign,
} from "./metaAgency.ts";

const LOCAL = "11111111-2222-3333-4444-555555555555";
const campaign = (over: Partial<MetaCampaign> = {}): MetaCampaign => ({
  id: "120200000000001", name: "x", status: "PAUSED", configured_status: "PAUSED", effective_status: "PAUSED",
  account_id: BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID, objective: "OUTCOME_LEADS", created_time: null, ...over,
});

Deno.test("Barber Launch Official is the only ad account: 2895514127400266", () => {
  assertEquals(BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID, "2895514127400266");
});

Deno.test("create body is always PAUSED with no budget or bid fields", () => {
  const body = buildPausedCampaignBody({ name: "Hair systems", localCampaignId: LOCAL, localObjective: "lead_generation", specialAdCategories: [] });
  assertEquals(body.status, "PAUSED");
  assertEquals(body.objective, "OUTCOME_LEADS");
  assertEquals(body.name, `Hair systems · BL-${LOCAL}`);
  for (const key of ["daily_budget", "lifetime_budget", "bid_strategy", "spend_cap", "start_time"]) {
    assertEquals(key in body, false);
  }
});

Deno.test("HTTP create posts only to Barber Launch Official, PAUSED, token in header only", async () => {
  const seen: Array<{ url: string; method?: string; body: URLSearchParams; auth: string | null }> = [];
  const fetchStub = async (input: string | URL, init?: RequestInit) => {
    seen.push({ url: String(input), method: init?.method, body: new URLSearchParams(String(init?.body ?? "")), auth: new Headers(init?.headers).get("Authorization") });
    return new Response(JSON.stringify({ id: "120200000000009" }), { status: 200 });
  };
  const client = createAgencyClient("server-token", fetchStub, "https://graph.facebook.com/v27.0");
  const body = buildPausedCampaignBody({ name: "A", localCampaignId: LOCAL, localObjective: "traffic", specialAdCategories: [] });
  assertEquals(await client.createPausedCampaign(body), { ok: true, data: { id: "120200000000009" } });
  assertEquals(seen[0].url, "https://graph.facebook.com/v27.0/act_2895514127400266/campaigns");
  assertEquals(seen[0].method, "POST");
  assertEquals(seen[0].body.get("status"), "PAUSED");
  assertEquals(seen[0].body.get("special_ad_categories"), "[]");
  assertEquals(seen[0].body.has("daily_budget") || seen[0].body.has("lifetime_budget") || seen[0].body.has("access_token"), false);
  assertEquals(seen[0].auth, "Bearer server-token");
  const active = { ...body, status: "ACTIVE" } as unknown as typeof body;
  assertThrows(() => client.createPausedCampaign(active));
});

Deno.test("create outcome: Meta 4xx error is definitive; 5xx and network failures are unknown", async () => {
  const body = buildPausedCampaignBody({ name: "A", localCampaignId: LOCAL, localObjective: "sales", specialAdCategories: [] });
  const with4xx = await createAgencyClient("t", async () => new Response(JSON.stringify({ error: { code: 100, message: "Invalid parameter" } }), { status: 400 })).createPausedCampaign(body);
  assertEquals(!with4xx.ok && with4xx.definitive, true);
  const transient = await createAgencyClient("t", async () => new Response(JSON.stringify({ error: { code: 2, is_transient: true } }), { status: 400 })).createPausedCampaign(body);
  assertEquals(!transient.ok && transient.definitive, false);
  const with5xx = await createAgencyClient("t", async () => new Response(JSON.stringify({ error: { code: 1 } }), { status: 500 })).createPausedCampaign(body);
  assertEquals(!with5xx.ok && with5xx.definitive, false);
  const network = await createAgencyClient("t", async () => { throw new Error("timeout"); }).createPausedCampaign(body);
  assertEquals(!network.ok && network.definitive, false);
});

Deno.test("special ad categories must be declared explicitly; a missing answer is never 'none'", () => {
  assertEquals(parseSpecialAdDeclaration(undefined).ok, false);
  assertEquals(parseSpecialAdDeclaration({}).ok, false);
  assertEquals(parseSpecialAdDeclaration({ declaration: "categories", categories: [] }).ok, false);
  assertEquals(parseSpecialAdDeclaration({ declaration: "categories", categories: ["CREDIT"] }).ok, false);
  assertEquals(parseSpecialAdDeclaration({ declaration: "none" }), { ok: true, categories: [] });
  assertEquals(parseSpecialAdDeclaration({ declaration: "categories", categories: ["EMPLOYMENT", "EMPLOYMENT"] }), { ok: true, categories: ["EMPLOYMENT"] });
});

Deno.test("link check: wrong account is rejected; only PAUSED campaigns link", () => {
  assertEquals(checkOfficialCampaign(campaign(), { requirePaused: true }).ok, true);
  assertEquals(checkOfficialCampaign(campaign({ account_id: "698039684068863" }), { requirePaused: true }).ok, false);
  assertEquals(checkOfficialCampaign(campaign({ account_id: null }), { requirePaused: false }).ok, false);
  const active = checkOfficialCampaign(campaign({ status: "ACTIVE", effective_status: "ACTIVE" }), { requirePaused: true });
  assertEquals(active.ok ? null : active.reason, "not_paused");
  assertEquals(checkOfficialCampaign(campaign({ status: "ACTIVE" }), { requirePaused: false }).ok, true);
});

Deno.test("delivery state follows Meta's effective_status", () => {
  assertEquals(deliveryState("ACTIVE"), "active");
  assertEquals(deliveryState("PAUSED"), "paused");
  assertEquals(deliveryState("ADSET_PAUSED"), "paused");
  assertEquals(deliveryState("WITH_ISSUES"), "attention");
  assertEquals(deliveryState(null), "unknown");
});

Deno.test("lead counting never adds overlapping action types", () => {
  assertEquals(countLeads([{ action_type: "lead", value: "5" }, { action_type: "onsite_conversion.lead_grouped", value: "5" }, { action_type: "leadgen_grouped", value: "5" }]), 5);
  assertEquals(countLeads([{ action_type: "onsite_conversion.lead_grouped", value: "3" }, { action_type: "offsite_conversion.fb_pixel_lead", value: "2" }]), 3);
  assertEquals(countLeads([{ action_type: "link_click", value: "40" }]), 0);
  assertEquals(countLeads(undefined), 0);
});

Deno.test("results are rejected when Meta attributes them to another account or campaign", () => {
  assertEquals(insightsBelongTo([{ account_id: "2895514127400266", campaign_id: "9" }], "9"), true);
  assertEquals(insightsBelongTo([{ account_id: "698039684068863", campaign_id: "9" }], "9"), false);
  assertEquals(insightsBelongTo([{ account_id: "2895514127400266", campaign_id: "8" }], "9"), false);
});

Deno.test("an empty insights answer is 'no delivery', never zero-filled results", () => {
  assertEquals(summarizeInsight([], "2026-10-19", "2026-11-17").has_delivery, false);
  const s = summarizeInsight([{ reach: "120", impressions: "300", spend: "12.34", actions: [{ action_type: "lead", value: "2" }] }], "a", "b");
  assertEquals([s.reach, s.impressions, s.spend_cents, s.leads, s.has_delivery], [120, 300, 1234, 2, true]);
});

Deno.test("a pasted server token is cleaned of whitespace, quotes and a Bearer prefix", () => {
  assertEquals(normalizeAgencyToken("  EAAabc\n"), "EAAabc");
  assertEquals(normalizeAgencyToken("Bearer EAAabc"), "EAAabc");
  assertEquals(normalizeAgencyToken('"EAAabc"'), "EAAabc");
  assertEquals(normalizeAgencyToken("EAA ab\nc"), "EAAabc");
  assertEquals(normalizeAgencyToken("   "), null);
  assertEquals(normalizeAgencyToken(undefined), null);
});

Deno.test("a token with characters Meta never issues is reported as invalid, not sent", () => {
  assertEquals(agencyTokenProblem("EAAabc123_-"), null);
  assertEquals(agencyTokenProblem("EAAabc…"), "invalid");
  assertEquals(agencyTokenProblem("  "), "missing");
});
