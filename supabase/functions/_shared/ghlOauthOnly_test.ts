import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getGhlAccess } from "./ghlMessaging.ts";

// Fake DB with an EMPTY ghl_oauth_tokens table.
const chain: any = {
  select: () => chain, order: () => chain, limit: () => chain,
  maybeSingle: async () => ({ data: null, error: null }),
};
const emptyDb: any = { from: () => chain };

Deno.test("disconnected OAuth: oauthOnly never falls back to a private-integration token", async () => {
  Deno.env.set("GHL_API_KEY", "private-token-should-not-be-used");
  Deno.env.set("GHL_LOCATION_ID", "loc");
  Deno.env.set("GHL_ENCRYPTION_KEY", "k");
  assertEquals(await getGhlAccess(emptyDb, { oauthOnly: true }), { error: "ghl_not_connected" });
  // Legacy callers keep their previous behaviour.
  assertEquals((await getGhlAccess(emptyDb) as any).locationId, "loc");
});
