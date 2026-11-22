// Server wiring for verified program enrollments. Service-role only.
// Structural type so callers using either supabase-js import path fit.
// deno-lint-ignore no-explicit-any
type SupabaseClient = { from: (table: string) => any };
import { ghlContactEmail } from '../barberLaunchGhlRelay.ts';
import { readStripeEvidenceByPaymentIntent } from '../hairSystemKit/readStripeEvidence.ts';
import { normalizeEmail, recordEnrollment, type EnrollmentRow, type EnrollmentSource, type StoredEnrollment } from './logic.ts';

export function enrollmentStore(db: SupabaseClient) {
  const table = () => db.from('program_enrollment_evidence');
  return {
    async insertIfAbsent(row: EnrollmentRow): Promise<'inserted' | 'duplicate' | 'conflict'> {
      const { error } = await table().insert(row);
      if (!error) return 'inserted';
      if (error.code !== '23505') throw new Error('enrollment_insert_failed');
      const { data, error: readError } = await table()
        .select('id,ghl_order_id,stripe_payment_intent_id,contact_email_normalized')
        .or(`ghl_order_id.eq.${row.ghl_order_id},stripe_payment_intent_id.eq.${row.stripe_payment_intent_id}`);
      if (readError || !data?.length) throw new Error('enrollment_duplicate_read_failed');
      if (data.length !== 1 || data[0].ghl_order_id !== row.ghl_order_id ||
        data[0].stripe_payment_intent_id !== row.stripe_payment_intent_id) return 'conflict';
      if (!data[0].contact_email_normalized && row.contact_email_normalized) {
        await table().update({ contact_email_normalized: row.contact_email_normalized })
          .eq('id', data[0].id).is('contact_email_normalized', null);
      }
      return 'duplicate';
    },
    async candidates(email: string): Promise<StoredEnrollment[]> {
      const normalized = normalizeEmail(email);
      if (!normalized) return [];
      // Two exact-match reads (no filter-string building from the email).
      const read = (column: string) => table().select('id,ghl_order_id,stripe_payment_intent_id,paid_at')
        .eq('status', 'verified').eq(column, normalized).order('paid_at', { ascending: true }).limit(10);
      const [contact, billing] = await Promise.all([read('contact_email_normalized'), read('billing_email_normalized')]);
      if (contact.error || billing.error) throw new Error('enrollment_lookup_failed');
      const byId = new Map<string, StoredEnrollment>();
      for (const row of [...(contact.data ?? []), ...(billing.data ?? [])]) byId.set(row.id, row);
      return [...byId.values()];
    },
    async revoke(id: string, reason: string) {
      await table().update({ status: 'revoked', revoked_reason: reason, revoked_at: new Date().toISOString() })
        .eq('id', id).eq('status', 'verified');
    },
  };
}

/** Called from the signed payment_intent.succeeded webhook after the kit
 * classifier matched. Re-reads Stripe and the linked GHL contact. */
export function recordProgramEnrollment(db: SupabaseClient, ref: { paymentId: string; orderId: string },
  eventId: string | null, stripeSecret: string, source: EnrollmentSource = 'stripe_webhook') {
  const store = enrollmentStore(db);
  return recordEnrollment({ paymentId: ref.paymentId, orderId: ref.orderId, source, eventId }, {
    readFresh: (paymentId, orderId) => readStripeEvidenceByPaymentIntent(paymentId, orderId, '', stripeSecret),
    contactEmail: ghlContactEmail,
    insertIfAbsent: store.insertIfAbsent,
  });
}
