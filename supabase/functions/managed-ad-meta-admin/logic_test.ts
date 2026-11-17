import { assertEquals } from "jsr:@std/assert@1";
import { createGate, reconcileDecision, savedPageAccessGranted, STALE_CREATE_MS, UNKNOWN_SETTLE_MS, type LocalCampaign } from "./logic.ts";

const NOW = Date.parse("2026-11-17T10:00:00.000Z");
const draft = (over: Partial<LocalCampaign> = {}): LocalCampaign => ({
  id: "11111111-2222-3333-4444-555555555555", customer_id: "c", name: "n", objective: "lead_generation", status: "draft",
  meta_ad_account_id: "2895514127400266", meta_campaign_id: null, meta_create_status: null, meta_create_started_at: null, ...over,
});
const ago = (ms: number) => new Date(NOW - ms).toISOString();

Deno.test("idempotent: a draft already holding a Meta campaign ID is never created again", () => {
  assertEquals(createGate(draft({ meta_campaign_id: "120", meta_create_status: "created" }), NOW), { kind: "already_linked", metaCampaignId: "120" });
});

Deno.test("only fresh or definitively failed drafts may claim a create", () => {
  assertEquals(createGate(draft(), NOW).kind, "claim");
  assertEquals(createGate(draft({ meta_create_status: "failed" }), NOW).kind, "claim");
  assertEquals(createGate(draft({ meta_create_status: "linked" }), NOW).kind, "blocked");
});

Deno.test("an in-flight create blocks; a stale or unknown one must be checked in Meta first", () => {
  assertEquals(createGate(draft({ meta_create_status: "creating", meta_create_started_at: ago(STALE_CREATE_MS - 1000) }), NOW).kind, "blocked");
  assertEquals(createGate(draft({ meta_create_status: "creating", meta_create_started_at: ago(STALE_CREATE_MS + 1000) }), NOW).kind, "reconcile_first");
  assertEquals(createGate(draft({ meta_create_status: "unknown" }), NOW).kind, "reconcile_first");
});

Deno.test("drafts on any other ad account (like the old test campaign) are never sent to Meta", () => {
  assertEquals(createGate(draft({ meta_ad_account_id: "698039684068863", status: "payment_required" }), NOW).kind, "blocked");
  assertEquals(createGate(draft({ status: "archived" }), NOW).kind, "blocked");
});

Deno.test("unknown outcome: adopt exactly one marked campaign, stop on several, wait before allowing a retry", () => {
  assertEquals(reconcileDecision(["9"], ago(0), NOW), { kind: "adopt", metaCampaignId: "9" });
  assertEquals(reconcileDecision(["9", "8"], ago(0), NOW).kind, "ambiguous");
  assertEquals(reconcileDecision([], ago(UNKNOWN_SETTLE_MS - 1000), NOW).kind, "wait");
  assertEquals(reconcileDecision([], ago(UNKNOWN_SETTLE_MS + 1000), NOW).kind, "safe_to_retry");
  assertEquals(reconcileDecision([], null, NOW).kind, "safe_to_retry");
});

Deno.test("create requires saved Meta-confirmed access for the customer's current Page", () => {
  const row = { connection_status: "connected", facebook_page_id: "1", page_ad_access_status: "granted", page_ad_access_page_id: "1" };
  assertEquals(savedPageAccessGranted(row), { ok: true, pageId: "1" });
  assertEquals(savedPageAccessGranted({ ...row, page_ad_access_status: "pending" }).ok, false);
  assertEquals(savedPageAccessGranted({ ...row, page_ad_access_page_id: "2" }).ok, false);
  assertEquals(savedPageAccessGranted({ ...row, connection_status: "disconnected" }).ok, false);
  assertEquals(savedPageAccessGranted(null).ok, false);
});
