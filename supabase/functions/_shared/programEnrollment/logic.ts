// Verified paid Barber Launch program enrollment (pure logic, no I/O).
// Source: GHL payment_link orders in The Barber Launch location, paid through
// Stripe. The offer list, location, Stripe application and evidence mapping
// are reused unchanged from the hair-system kit path; this module only reads
// them and never touches kit storage, deliveries or messages.
import { KIT_LOCATION, KIT_STRIPE_APPLICATION, kitEnrollmentOffer, type KitEvidence } from '../hairSystemKit/logic.ts';

export const ENROLLMENT_LOCATION = KIT_LOCATION;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER_ID = /^[a-f0-9]{24}$/i;

export const normalizeEmail = (value: unknown): string | null => {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 320 && EMAIL.test(email) ? email : null;
};

/** Reasons that prove the payment no longer counts (not transient read failures). */
export const DEFINITIVE_REVOKE_REASONS = new Set(['payment_not_completed', 'refunded_or_unknown', 'received_amount_not_verified', 'wrong_currency']);

/** Same offer, linkage and paid-in-full checks as qualifyKit, without the kit's
 * activation cutoff, shipping or phone requirements (those gate supplier
 * sends, not proof of purchase). Evidence must be a fresh Stripe re-read. */
export function qualifyEnrollment(e: KitEvidence, orderId: string, now = Date.now()): string | null {
  const offer = kitEnrollmentOffer(e.order.description);
  if (!offer) return 'wrong_order_or_offer';
  const read = Date.parse(e.readAt);
  if (!Number.isFinite(read) || read > now || now - read > 30_000) return 'fresh_evidence_missing';
  const o = e.order, p = e.payment;
  if (!ORDER_ID.test(orderId) || o.id !== orderId || o.locationId !== ENROLLMENT_LOCATION || p.orderId !== orderId ||
    p.locationId !== ENROLLMENT_LOCATION || !p.contactId || p.application !== KIT_STRIPE_APPLICATION) return 'payment_linkage_missing';
  const created = Date.parse(o.createdAt), paid = Date.parse(o.paidAt);
  if (!Number.isFinite(created) || !Number.isFinite(paid) || paid < created || paid > now) return 'purchase_time_unverified';
  if (!/^pi_[A-Za-z0-9]+$/.test(p.id) || !/^(ch|py)_[A-Za-z0-9]+$/.test(p.chargeId) ||
    p.live !== true || p.status !== 'succeeded' || p.chargeStatus !== 'succeeded' ||
    p.chargePaid !== true || p.chargeCaptured !== true || p.disputed !== false) return 'payment_not_completed';
  if (p.currency !== 'usd') return 'wrong_currency';
  if (!Number.isSafeInteger(p.receivedMinor) || p.receivedMinor < offer.minimumReceivedMinor ||
    !Number.isSafeInteger(p.chargeAmountMinor) || p.chargeAmountMinor !== p.receivedMinor) return 'received_amount_not_verified';
  if (p.refundedMinor !== 0) return 'refunded_or_unknown';
  return null;
}

export type EnrollmentSource = 'stripe_webhook' | 'backfill';
export type EnrollmentRow = {
  ghl_order_id: string; ghl_location_id: string; ghl_contact_id: string;
  stripe_payment_intent_id: string; stripe_charge_id: string; offer_description: string;
  amount_received_minor: number; currency: string;
  contact_email_normalized: string | null; billing_email_normalized: string | null;
  order_created_at: string; paid_at: string; source: EnrollmentSource; source_event_id: string | null;
};

export function enrollmentRow(e: KitEvidence, contactEmail: string | null, source: EnrollmentSource, eventId: string | null): EnrollmentRow {
  const contact = normalizeEmail(contactEmail), billing = normalizeEmail(e.contact.email);
  if (!contact && !billing) throw new Error('enrollment_email_missing');
  return {
    ghl_order_id: e.order.id, ghl_location_id: e.order.locationId, ghl_contact_id: e.payment.contactId,
    stripe_payment_intent_id: e.payment.id, stripe_charge_id: e.payment.chargeId, offer_description: e.order.description,
    amount_received_minor: e.payment.receivedMinor, currency: e.payment.currency,
    contact_email_normalized: contact, billing_email_normalized: billing,
    order_created_at: e.order.createdAt, paid_at: e.order.paidAt, source, source_event_id: eventId,
  };
}

export type RecordDeps = {
  readFresh: (paymentId: string, orderId: string) => Promise<KitEvidence>;
  /** Email of the GHL contact linked by the PaymentIntent metadata (location-checked). */
  contactEmail: (contactId: string) => Promise<string | null>;
  insertIfAbsent: (row: EnrollmentRow) => Promise<'inserted' | 'duplicate' | 'conflict'>;
};
export type RecordResult = { status: 'recorded' | 'duplicate' | 'blocked' | 'unavailable'; reason?: string };

/** Idempotent: one row per GHL order / PaymentIntent. Never sends, charges or
 * writes kit/order/supplier records. */
export async function recordEnrollment(input: { paymentId: string; orderId: string; source: EnrollmentSource; eventId: string | null },
  d: RecordDeps): Promise<RecordResult> {
  let e: KitEvidence;
  try { e = await d.readFresh(input.paymentId, input.orderId); }
  catch { return { status: 'unavailable', reason: 'fresh_stripe_read_failed' }; }
  if (e.payment.id !== input.paymentId) return { status: 'blocked', reason: 'payment_mismatch' };
  const reason = qualifyEnrollment(e, input.orderId);
  if (reason) return { status: 'blocked', reason };
  let contact: string | null = null;
  try { contact = await d.contactEmail(e.payment.contactId); } catch { contact = null; }
  let row: EnrollmentRow;
  try { row = enrollmentRow(e, contact, input.source, input.eventId); }
  catch { return { status: 'blocked', reason: 'enrollment_email_missing' }; }
  const stored = await d.insertIfAbsent(row);
  if (stored === 'conflict') return { status: 'blocked', reason: 'existing_record_conflict' };
  return { status: stored === 'inserted' ? 'recorded' : 'duplicate' };
}

export type StoredEnrollment = { id: string; ghl_order_id: string; stripe_payment_intent_id: string; paid_at: string };
export type TrialDeps = {
  facts: (email: string) => Promise<{ confirmed_account: boolean; certified: boolean; certified_at: string | null }>;
  candidates: (email: string) => Promise<StoredEnrollment[]>;
  readFresh: (paymentId: string, orderId: string) => Promise<KitEvidence>;
  revoke: (id: string, reason: string) => Promise<void>;
};
export type TrialStatus = { certified: boolean; certifiedAt: string | null; programStartedAt: string | null; enrollmentOrderId: string | null };

const isoOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

/** Enrollment fields are returned only for a confirmed, certified Auth email
 * (valid certifiedAt) whose stored
 * evidence re-verifies against current Stripe state right now. Any read
 * failure returns null trial fields (fail closed); certification is unaffected. */
export async function certificationTrialStatus(email: string, d: TrialDeps): Promise<TrialStatus> {
  const facts = await d.facts(email);
  const certified = facts.certified === true;
  const result: TrialStatus = { certified, certifiedAt: certified ? isoOrNull(facts.certified_at) : null,
    programStartedAt: null, enrollmentOrderId: null };
  // Trial fields require a confirmed account AND an issued hair-system
  // certificate with a valid issue date; otherwise enrollment is never read.
  if (facts.confirmed_account !== true || !certified || result.certifiedAt === null) return result;
  let rows: StoredEnrollment[];
  try { rows = await d.candidates(email); } catch { return result; }
  const ordered = [...rows].sort((a, b) => Date.parse(a.paid_at) - Date.parse(b.paid_at));
  for (const row of ordered) {
    let e: KitEvidence;
    try { e = await d.readFresh(row.stripe_payment_intent_id, row.ghl_order_id); }
    catch { return result; } // cannot prove the earliest enrollment: fail closed
    const reason = e.payment.id === row.stripe_payment_intent_id ? qualifyEnrollment(e, row.ghl_order_id) : 'payment_mismatch';
    if (!reason) return { ...result, enrollmentOrderId: row.ghl_order_id, programStartedAt: isoOrNull(e.order.paidAt) };
    if (DEFINITIVE_REVOKE_REASONS.has(reason)) { await d.revoke(row.id, reason).catch(() => {}); continue; }
    return result;
  }
  return result;
}

/** Stripe search hits are only leads, never proof: keep exact-offer, live,
 * succeeded PaymentIntents in the enrollment location with a GHL order ID.
 * Each lead is re-retrieved and fully qualified before anything is stored. */
export function enrollmentSearchLeads(hits: unknown[]): { paymentId: string; orderId: string }[] {
  const leads: { paymentId: string; orderId: string }[] = [];
  const seen = new Set<string>();
  for (const raw of hits) {
    const pi = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const metadata = pi.metadata && typeof pi.metadata === 'object' ? pi.metadata as Record<string, unknown> : {};
    const paymentId = String(pi.id ?? ''), orderId = String(metadata.orderId ?? '');
    if (pi.object !== 'payment_intent' || pi.livemode !== true || pi.status !== 'succeeded' ||
      pi.application !== KIT_STRIPE_APPLICATION || metadata.altId !== ENROLLMENT_LOCATION || metadata.altType !== 'location' ||
      !kitEnrollmentOffer(String(pi.description ?? '')) || !/^pi_[A-Za-z0-9]+$/.test(paymentId) || !ORDER_ID.test(orderId) ||
      seen.has(orderId)) continue;
    seen.add(orderId);
    leads.push({ paymentId, orderId });
  }
  return leads;
}

/** Keep a background task alive after the response when the edge runtime
 * supports it; otherwise await it so the work cannot be silently dropped. */
export async function runAfterResponseOrAwait(task: Promise<unknown>,
  // deno-lint-ignore no-explicit-any
  runtime: any = (globalThis as any).EdgeRuntime): Promise<void> {
  if (typeof runtime?.waitUntil === 'function') { runtime.waitUntil(task); return; }
  await task;
}
