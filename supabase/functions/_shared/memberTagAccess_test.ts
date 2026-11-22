import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyTagLookup, decideMemberTag, lookupMemberTag, MEMBER_ACCESS_TAG, tagEvidenceRef,
  type TagGrantRow, type TagGrantStore,
} from "./memberTagAccess.ts";

const LOC = "JVBUuL3dVwZahuGay9T1";
const access = { accessToken: "test-token", locationId: LOC };
const contact = (over: Record<string, unknown> = {}) => ({
  id: "abcDEF1234567890abcd", locationId: LOC, email: "Member@Example.com ", tags: ["vip", MEMBER_ACCESS_TAG], ...over,
});

/** Fake GHL: search returns ids, contact reads return full records. */
function fakeGhl(contacts: any[], opts: { searchStatus?: number; total?: number } = {}) {
  const calls: string[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push(`${init?.method ?? "GET"} ${u.replace("https://services.leadconnectorhq.com", "")}`);
    if (u.endsWith("/contacts/search")) {
      if (opts.searchStatus) return new Response("err", { status: opts.searchStatus });
      return Response.json({ contacts: contacts.map((c) => ({ id: c.id, email: c.email })), total: opts.total ?? contacts.length });
    }
    const id = u.split("/contacts/")[1];
    const c = contacts.find((x) => x.id === id);
    return c ? Response.json({ contact: c }) : new Response("nf", { status: 404 });
  }) as typeof fetch;
  return { f, calls };
}

function memStore(initial: (TagGrantRow & Record<string, unknown>)[] = []) {
  const rows = initial.map((r) => ({ ...r }));
  const store: TagGrantStore = {
    async get(ref) { return rows.find((r) => r.evidence_ref === ref) ?? null; },
    async insert(row) {
      if (rows.some((r) => r.evidence_ref === row.evidence_ref)) return; // ON CONFLICT DO NOTHING
      rows.push({ id: `g${rows.length + 1}`, revoked_by: null, ...(row as any) });
    },
    async update(id, patch, onlyIfStatus) {
      const r = rows.find((x) => x.id === id && x.status === onlyIfStatus);
      if (r) Object.assign(r, patch);
    },
  };
  return { store, rows };
}

const email = "member@example.com";

Deno.test("exact normalized email in the approved location with the tag grants", async () => {
  const { f, calls } = fakeGhl([contact()]);
  const lookup = await lookupMemberTag(access, " MEMBER@example.com ", f);
  assertEquals(lookup, { status: "tagged", contactId: "abcDEF1234567890abcd" });
  // Searched by email only — never by name or phone.
  assertEquals(calls[0], "POST /contacts/search");
  const { store, rows } = memStore();
  const r = await applyTagLookup(store, lookup, { email, userId: null, allowGrant: true });
  assertEquals(r.outcome, "granted");
  assertEquals(rows.length, 1);
  assertEquals([rows[0].source, rows[0].evidence_ref, rows[0].status], ["ghl_member_tag", tagEvidenceRef(email), "active"]);
});

Deno.test("a near-miss email never counts", () => {
  assertEquals(decideMemberTag([contact({ email: "member+1@example.com" })], email).status, "not_tagged");
  assertEquals(decideMemberTag([contact({ email: "member@example.co" })], email).status, "not_tagged");
});

Deno.test("wrong location never grants", async () => {
  assertEquals(decideMemberTag([contact({ locationId: "OtherLocation00000000" })], email).status, "not_tagged");
  const r = await lookupMemberTag({ accessToken: "x", locationId: "OtherLocation00000000" }, email, fakeGhl([contact()]).f);
  assertEquals(r, { status: "unavailable", reason: "ghl_wrong_location" });
  const notConfigured = await lookupMemberTag({ error: "ghl_not_configured" }, email);
  assertEquals(notConfigured.status, "unavailable");
});

Deno.test("tag absent: no grant is created", async () => {
  const { f } = fakeGhl([contact({ tags: ["vip", "barber-launch-member-access-old"] })]);
  const lookup = await lookupMemberTag(access, email, f);
  assertEquals(lookup.status, "not_tagged");
  const { store, rows } = memStore();
  assertEquals((await applyTagLookup(store, lookup, { email, userId: "u1", allowGrant: true })).outcome, "unchanged_absent");
  assertEquals(rows.length, 0);
});

Deno.test("duplicate sync is idempotent: one grant, no repeat changes", async () => {
  const { store, rows } = memStore();
  const lookup = { status: "tagged" as const, contactId: "abcDEF1234567890abcd" };
  assertEquals((await applyTagLookup(store, lookup, { email, userId: null, allowGrant: true })).outcome, "granted");
  assertEquals((await applyTagLookup(store, lookup, { email, userId: null, allowGrant: true })).outcome, "unchanged_active");
  assertEquals((await applyTagLookup(store, lookup, { email, userId: "u1", allowGrant: true })).outcome, "linked");
  assertEquals((await applyTagLookup(store, lookup, { email, userId: "u1", allowGrant: true })).outcome, "unchanged_active");
  assertEquals(rows.length, 1);
  assertEquals(rows[0].user_id, "u1");
});

Deno.test("removal revokes only the tag grant; purchase and admin grants stay", async () => {
  const { store, rows } = memStore([
    { id: "p1", user_id: "u1", status: "active", revoked_by: null, source: "stripe_charge", evidence_ref: "ch_1" },
    { id: "a1", user_id: "u1", status: "active", revoked_by: null, source: "admin_grant", evidence_ref: "admin:1" },
    { id: "t1", user_id: "u1", status: "active", revoked_by: null, source: "ghl_member_tag", evidence_ref: tagEvidenceRef(email) },
  ]);
  const r = await applyTagLookup(store, { status: "not_tagged", contactsChecked: 1 }, { email, userId: "u1", allowGrant: true });
  assertEquals(r.outcome, "revoked");
  assertEquals(rows.map((x) => [x.id, x.status]), [["p1", "active"], ["a1", "active"], ["t1", "revoked"]]);
  assertEquals([rows[2].revoked_by_system, rows[2].status_reason], [true, "ghl_tag_removed"]);
  // Re-adding the tag reinstates it; an admin-ended tag grant is never reinstated.
  assertEquals((await applyTagLookup(store, { status: "tagged", contactId: "abcDEF1234567890abcd" }, { email, userId: "u1", allowGrant: true })).outcome, "reinstated");
  rows[2].status = "revoked"; rows[2].revoked_by = "admin-1";
  assertEquals((await applyTagLookup(store, { status: "tagged", contactId: "abcDEF1234567890abcd" }, { email, userId: "u1", allowGrant: true })).outcome, "admin_ended");
  assertEquals(rows[2].status, "revoked");
});

Deno.test("GHL failure never grants or revokes", async () => {
  for (const ghl of [fakeGhl([contact()], { searchStatus: 500 }), fakeGhl([contact()], { searchStatus: 401 }), fakeGhl([contact()], { total: 99 })]) {
    const lookup = await lookupMemberTag(access, email, ghl.f);
    assertEquals(lookup.status, "unavailable");
    const { store, rows } = memStore([
      { id: "t1", user_id: "u1", status: "active", revoked_by: null, source: "ghl_member_tag", evidence_ref: tagEvidenceRef(email) },
    ]);
    assertEquals((await applyTagLookup(store, lookup, { email, userId: "u1", allowGrant: true })).outcome, "unavailable");
    assertEquals(rows[0].status, "active");
  }
  const thrown = (async () => { throw new Error("network down"); }) as typeof fetch;
  assertEquals((await lookupMemberTag(access, email, thrown)).status, "unavailable");
});

Deno.test("check-only lookup never creates a grant", async () => {
  const { store, rows } = memStore();
  const r = await applyTagLookup(store, { status: "tagged", contactId: "abcDEF1234567890abcd" }, { email, userId: null, allowGrant: false });
  assertEquals(r.outcome, "tag_only_check");
  assertEquals(rows.length, 0);
});
