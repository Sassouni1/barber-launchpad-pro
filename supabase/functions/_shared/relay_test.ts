import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { __setRelayFetch, relayCall, relayProbe } from "./barberLaunchGhlRelay.ts";
import { buildCrmOrderNote, sendSupplierEmail } from "./hairSystemNotifications.ts";

Deno.env.set("GHL_API_KEY", "pit-SECRETVALUE");
Deno.test("relay sends bearer, never leaks key in errors", async () => {
  let auth = "";
  __setRelayFetch(async (_u, init) => { auth = (init?.headers as any).Authorization; return new Response(JSON.stringify({ error: "bad pit-SECRETVALUE" }), { status: 403 }); });
  const r = await relayCall("probe");
  assertEquals(auth, "Bearer pit-SECRETVALUE");
  assert(!r.ok && !r.reason.includes("SECRETVALUE"));
});
Deno.test("probe requires exact location", async () => {
  __setRelayFetch(async () => new Response(JSON.stringify({ ok: true, locationId: "OTHER" })));
  assertEquals((await relayProbe()).ready, false);
  __setRelayFetch(async () => new Response(JSON.stringify({ ok: true, locationId: "JVBUuL3dVwZahuGay9T1" })));
  assertEquals((await relayProbe()).ready, true);
});
Deno.test("supplier recipient fixed", async () => {
  let called = false;
  __setRelayFetch(async () => { called = true; return new Response("{}"); });
  const r = await sendSupplierEmail({} as any, { to: "x@y.com", subject: "s", html: "h" });
  assert(!r.ok && !called);
});
Deno.test("crm note has order id, specs, shipping, stripe ref", () => {
  const note = buildCrmOrderNote(
    [{ id: "fa6a29dc-62e3-49ad-9927-e1093ad59fd0", customer_email: "a@b.com", customer_name: "A B", order_details: { full_name: "A B", notes: "rush" } } as any],
    { name: "A B", email: "a@b.com", phone: "", address: ["1 Main St"] } as any,
    { sessionId: "cs_live_x", amountPaid: 25000, currency: "usd", paidAt: new Date(0) },
  );
  for (const s of ["fa6a29dc-62e3-49ad-9927-e1093ad59fd0", "cs_live_x", "250.00 USD", "1 Main St", "rush"]) assert(note.includes(s), s);
});
