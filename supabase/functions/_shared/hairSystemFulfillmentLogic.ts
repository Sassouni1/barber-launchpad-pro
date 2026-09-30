// Pure decision logic for the paid hair-system pipeline (no I/O) so the
// verification, replay plan and webhook-coverage rules are unit-testable.

export const HAIR_SYSTEM_SELLER_ACCOUNT = "acct_1LMNKMI6LFtj88Bq"; // Invasion Digital Media
export const HAIR_WEBHOOK_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
export const PRIMARY_CHANNELS = ["crm_sync", "customer_receipt", "customer_sms"] as const;
export type AnyChannel = "supplier_email" | (typeof PRIMARY_CHANNELS)[number];

export function orderIdsFromMetadata(metadata: Record<string, unknown> | null | undefined): string[] {
  return String(metadata?.order_ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** New checkouts carry a private draft reference instead of pre-created order rows. */
export function draftIdFromMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  const v = String(metadata?.draft_id ?? "").trim();
  return UUID_RE.test(v) ? v.toLowerCase() : null;
}

/** Durable per-system payment reference; mirrors hair_system_materialize_paid_draft. */
export function paymentReference(sessionId: string, systemIndex: number) {
  return `stripe:${sessionId}:${systemIndex}`;
}

export type SessionCheck = { ok: true; orderIds: string[]; draftId: string | null } | { ok: false; reason: string };

/**
 * A session may only drive order creation or sends when Stripe says it is paid
 * and it carries either historical order_ids or a draft reference.
 */
export function verifyPaidSession(
  session: Record<string, any> | null | undefined,
  opts: { requireOrderId?: string; expectedUserId?: string } = {},
): SessionCheck {
  if (!session || session.object !== "checkout.session") return { ok: false, reason: "not_a_checkout_session" };
  const orderIds = orderIdsFromMetadata(session.metadata);
  const draftId = draftIdFromMetadata(session.metadata);
  if (!orderIds.length && !draftId) return { ok: false, reason: "no_order_ids_metadata" };
  if (opts.requireOrderId && !orderIds.includes(opts.requireOrderId)) return { ok: false, reason: "order_id_not_in_metadata" };
  if (opts.expectedUserId && session.metadata?.user_id !== opts.expectedUserId) return { ok: false, reason: "user_mismatch" };
  if (session.payment_status !== "paid") return { ok: false, reason: `not_paid:${session.payment_status ?? "unknown"}` };
  return { ok: true, orderIds, draftId };
}

export type NotificationRow = { order_id: string; channel: string; status: string; updated_at?: string | null };
export type PlanAction = "already_sent" | "in_progress" | "replay";

/** Channels a purchase owes: supplier sheet per order; crm/receipt/sms once on the first order. */
export function expectedChannels(orderIds: string[]): Array<{ orderId: string; channel: AnyChannel }> {
  if (!orderIds.length) return [];
  return [
    ...orderIds.map((orderId) => ({ orderId, channel: "supplier_email" as AnyChannel })),
    ...PRIMARY_CHANNELS.map((channel) => ({ orderId: orderIds[0], channel: channel as AnyChannel })),
  ];
}

/** Mirrors claim_order_notification: sent = done, fresh sending = busy, everything else replays. */
export function planReplay(orderIds: string[], rows: NotificationRow[], now = Date.now()) {
  return expectedChannels(orderIds).map(({ orderId, channel }) => {
    const row = rows.find((r) => r.order_id === orderId && r.channel === channel);
    let action: PlanAction = "replay";
    if (row?.status === "sent") action = "already_sent";
    else if (row?.status === "sending" && row.updated_at && now - new Date(row.updated_at).getTime() < 10 * 60 * 1000) action = "in_progress";
    return { orderId, channel, current: row?.status ?? "none", action };
  });
}

export type WebhookEndpoint = { id: string; url: string; status: string; enabled_events: string[] };

export function webhookCoverage(endpoints: WebhookEndpoint[], expectedUrl: string) {
  const norm = (u: string) => u.split("?")[0].replace(/\/+$/, "");
  const matches = endpoints.filter((e) => norm(e.url) === norm(expectedUrl));
  if (!matches.length) return { configured: false, reason: "no_endpoint_for_url", missingEvents: HAIR_WEBHOOK_EVENTS };
  const enabled = matches.filter((e) => e.status === "enabled");
  if (!enabled.length) return { configured: false, reason: "endpoint_disabled", missingEvents: HAIR_WEBHOOK_EVENTS };
  const events = new Set(enabled.flatMap((e) => e.enabled_events));
  const missingEvents = events.has("*") ? [] : HAIR_WEBHOOK_EVENTS.filter((e) => !events.has(e));
  return { configured: missingEvents.length === 0, reason: missingEvents.length ? "missing_events" : "ok", missingEvents, endpointIds: enabled.map((e) => e.id) };
}

export type FulfillmentCutover = { at: string; excluded_order_ids?: string[] } | null;

/**
 * Automatic paths (signed webhook, buyer return) only fulfill checkouts created
 * at/after the cutover and never excluded historical orders. Missing or invalid
 * cutover fails closed. Manual admin reconcile does not use this gate.
 */
export function automaticFulfillmentAllowed(
  sessionCreatedSec: unknown,
  orderIds: string[],
  cutover: FulfillmentCutover,
): { ok: true } | { ok: false; reason: string } {
  const cutMs = cutover?.at ? Date.parse(cutover.at) : NaN;
  if (!Number.isFinite(cutMs)) return { ok: false, reason: "cutover_not_configured" };
  const created = Number(sessionCreatedSec);
  if (!Number.isFinite(created) || created <= 0) return { ok: false, reason: "session_created_unknown" };
  const excluded = new Set((cutover?.excluded_order_ids ?? []).map((s) => s.toLowerCase()));
  if (orderIds.some((id) => excluded.has(id.toLowerCase()))) return { ok: false, reason: "historical_order_excluded" };
  if (created * 1000 < cutMs) return { ok: false, reason: "session_before_cutover" };
  return { ok: true };
}
