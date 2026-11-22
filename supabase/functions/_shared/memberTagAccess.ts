// Member access from one exact HighLevel contact tag in the approved Barber Launch
// location. The tag is NOT a purchase: it creates or reinstates only one
// tag-sourced grant per exact email (source "ghl_member_tag"), never an admin
// role and never a change to the purchase gate or access switch.
// - Grant only when a successful current lookup finds a contact in the approved
//   location whose email equals the account email exactly (trimmed, lowercased)
//   and whose tags include the exact tag. Name and phone are never used.
// - Revoke only the tag-sourced grant, only when a successful lookup shows the tag
//   is gone. A failed or unclear lookup changes nothing.
// - A tag grant an admin ended (revoked_by set) is never reinstated automatically.
// Credentials stay server-side; nothing here sends messages.
import { APPROVED_GHL_LOCATION_ID } from "./hairSystemGhlAccess.ts";
import { normalizeEmailOrNull } from "./memberAccess.ts";

export const MEMBER_ACCESS_TAG = "barber-launch-member-access";
export const TAG_GRANT_SOURCE = "ghl_member_tag";
const GHL_BASE = "https://services.leadconnectorhq.com";
const MAX_CONTACTS = 10;

export type TagLookup =
  | { status: "tagged"; contactId: string }
  | { status: "not_tagged"; contactsChecked: number }
  | { status: "unavailable"; reason: string };

type FetchLike = typeof fetch;
type Access = { accessToken: string; locationId: string };

export const tagEvidenceRef = (email: string) => `${APPROVED_GHL_LOCATION_ID}:${MEMBER_ACCESS_TAG}:${email}`;

/** Pure decision over full contact records already read from the approved location. */
export function decideMemberTag(contacts: any[], email: string): TagLookup {
  const exact = contacts.filter((c) =>
    c && typeof c.id === "string" && c.locationId === APPROVED_GHL_LOCATION_ID && normalizeEmailOrNull(c.email) === email
  );
  const tagged = exact.find((c) =>
    Array.isArray(c.tags) && c.tags.some((t: unknown) => typeof t === "string" && t.trim().toLowerCase() === MEMBER_ACCESS_TAG)
  );
  return tagged ? { status: "tagged", contactId: tagged.id } : { status: "not_tagged", contactsChecked: exact.length };
}

/** Read-only: every contact in the approved location with this exact email, then their full records. */
export async function lookupMemberTag(access: Access | { error: string }, rawEmail: string, fetchImpl: FetchLike = fetch): Promise<TagLookup> {
  if ("error" in access) return { status: "unavailable", reason: access.error };
  if (access.locationId !== APPROVED_GHL_LOCATION_ID) return { status: "unavailable", reason: "ghl_wrong_location" };
  const email = normalizeEmailOrNull(rawEmail);
  if (!email) return { status: "unavailable", reason: "invalid_email" };
  const headers = { Authorization: `Bearer ${access.accessToken}`, Version: "2021-07-28", Accept: "application/json", "Content-Type": "application/json" };
  try {
    const res = await fetchImpl(`${GHL_BASE}/contacts/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        locationId: APPROVED_GHL_LOCATION_ID, page: 1, pageLimit: MAX_CONTACTS * 2,
        filters: [{ field: "email", operator: "eq", value: email }],
      }),
    });
    if (!res.ok) { await res.body?.cancel(); return { status: "unavailable", reason: `ghl_search_http_${res.status}` }; }
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.contacts)) return { status: "unavailable", reason: "ghl_search_unreadable" };
    const total = typeof data.total === "number" ? data.total : data.contacts.length;
    if (total > data.contacts.length) return { status: "unavailable", reason: "ghl_search_incomplete" };
    const candidates = data.contacts.filter((c: any) => typeof c?.id === "string" && normalizeEmailOrNull(c.email) === email);
    if (candidates.length > MAX_CONTACTS) return { status: "unavailable", reason: "ghl_too_many_contacts" };
    const full: any[] = [];
    for (const c of candidates) {
      if (!/^[A-Za-z0-9]{10,40}$/.test(c.id)) return { status: "unavailable", reason: "ghl_contact_id_invalid" };
      const r = await fetchImpl(`${GHL_BASE}/contacts/${c.id}`, { headers });
      if (!r.ok) { await r.body?.cancel(); return { status: "unavailable", reason: `ghl_contact_http_${r.status}` }; }
      const j = await r.json().catch(() => null);
      const contact = j?.contact;
      if (!contact || contact.id !== c.id) return { status: "unavailable", reason: "ghl_contact_unreadable" };
      full.push(contact);
    }
    return decideMemberTag(full, email);
  } catch (e) {
    return { status: "unavailable", reason: `ghl_fetch_error:${e instanceof Error ? e.message.slice(0, 80) : "fetch"}` };
  }
}

export type TagGrantRow = {
  id: string; user_id: string | null; status: string; revoked_by: string | null;
};
export interface TagGrantStore {
  get(evidenceRef: string): Promise<TagGrantRow | null>;
  insert(row: Record<string, unknown>): Promise<void>; // must ignore a concurrent duplicate
  update(id: string, patch: Record<string, unknown>, onlyIfStatus: string): Promise<void>;
}

export type TagSyncResult =
  | { outcome: "unavailable"; reason: string }
  | { outcome: "granted" | "reinstated" | "linked" | "unchanged_active" | "revoked" | "unchanged_absent" | "admin_ended" | "tag_only_check"; changed: boolean };

/**
 * Applies one lookup to the single tag grant for this email. allowGrant=false
 * checks the tag without creating a grant (still revokes on a successful absent read).
 */
export async function applyTagLookup(
  store: TagGrantStore,
  lookup: TagLookup,
  input: { email: string; userId: string | null; allowGrant: boolean; now?: Date },
): Promise<TagSyncResult> {
  if (lookup.status === "unavailable") return { outcome: "unavailable", reason: lookup.reason };
  const ref = tagEvidenceRef(input.email);
  const now = (input.now ?? new Date()).toISOString();
  const existing = await store.get(ref);

  if (lookup.status === "not_tagged") {
    if (!existing || existing.status !== "active") return { outcome: "unchanged_absent", changed: false };
    await store.update(existing.id, {
      status: "revoked", revoked_by_system: true, revoked_at: now, status_reason: "ghl_tag_removed",
    }, "active");
    return { outcome: "revoked", changed: true };
  }

  const description = `HighLevel tag ${MEMBER_ACCESS_TAG} (contact ${lookup.contactId})`;
  if (!existing) {
    if (!input.allowGrant) return { outcome: "tag_only_check", changed: false };
    await store.insert({
      user_id: input.userId, email_normalized: input.email, source: TAG_GRANT_SOURCE, evidence_ref: ref,
      description, status: "active", status_reason: "ghl_tag_present",
    });
    return { outcome: "granted", changed: true };
  }
  if (existing.status !== "active") {
    if (existing.revoked_by) return { outcome: "admin_ended", changed: false };
    if (!input.allowGrant) return { outcome: "tag_only_check", changed: false };
    await store.update(existing.id, {
      status: "active", status_reason: "ghl_tag_present", revoked_by_system: false, revoked_at: null, description,
      ...(existing.user_id ? {} : input.userId ? { user_id: input.userId } : {}),
    }, "revoked");
    return { outcome: "reinstated", changed: true };
  }
  if (!existing.user_id && input.userId) {
    await store.update(existing.id, { user_id: input.userId }, "active");
    return { outcome: "linked", changed: false };
  }
  return { outcome: "unchanged_active", changed: false };
}

/** Supabase-backed store (service role). Writes fail loudly so callers report check_unavailable. */
export function supabaseTagStore(db: any): TagGrantStore {
  return {
    async get(ref) {
      const { data, error } = await db.from("member_access_grants").select("id, user_id, status, revoked_by")
        .eq("source", TAG_GRANT_SOURCE).eq("evidence_ref", ref).maybeSingle();
      if (error) throw new Error("tag_grant_read_failed");
      return data ?? null;
    },
    async insert(row) {
      const { error } = await db.from("member_access_grants").upsert(row, { onConflict: "source,evidence_ref", ignoreDuplicates: true });
      if (error) throw new Error("tag_grant_write_failed");
    },
    async update(id, patch, onlyIfStatus) {
      const { error } = await db.from("member_access_grants").update(patch)
        .eq("id", id).eq("source", TAG_GRANT_SOURCE).eq("status", onlyIfStatus);
      if (error) throw new Error("tag_grant_write_failed");
    },
  };
}

/** Lookup + apply. Any thrown store error is reported as unavailable (no partial claims). */
export async function syncMemberTag(
  db: any,
  access: Access | { error: string },
  input: { email: string; userId: string | null; allowGrant: boolean },
  fetchImpl: FetchLike = fetch,
): Promise<TagSyncResult> {
  const lookup = await lookupMemberTag(access, input.email, fetchImpl);
  try {
    return await applyTagLookup(supabaseTagStore(db), lookup, input);
  } catch (e) {
    return { outcome: "unavailable", reason: e instanceof Error ? e.message : "tag_grant_error" };
  }
}

/** Does this account currently hold an active tag grant (by id or by exact email)? */
export async function hasActiveTagGrant(db: any, userId: string, email: string): Promise<boolean | null> {
  const { data, error } = await db.from("member_access_grants").select("id, user_id")
    .eq("source", TAG_GRANT_SOURCE).eq("status", "active").eq("evidence_ref", tagEvidenceRef(email)).limit(1);
  if (error) return null;
  return (data ?? []).some((g: any) => !g.user_id || g.user_id === userId);
}
