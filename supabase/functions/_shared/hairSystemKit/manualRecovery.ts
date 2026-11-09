import { kitEmail, kitOrderRow, KIT_LOCATION, type KitEvidence } from './logic.ts';
import { manualPreviewFacts, normalizeManualRequest, qualifyManualKit, type ManualRequest } from './manual.ts';

export type VerifiedGhlOrder = { id: string; locationId: string; contactId: string; productIds: string[];
  paymentStatus: string; status: string; updatedAt: string };
export type ManualDeps = {
  readFresh: (input: ManualRequest) => Promise<{ evidence: KitEvidence; order: VerifiedGhlOrder }>;
  checkExisting: (orderId: string, paymentId: string) => Promise<void>;
  claim: (facts: ReturnType<typeof manualPreviewFacts>, adminId: string) => Promise<void>;
  ensureRow: (row: ReturnType<typeof kitOrderRow>) => Promise<string>;
  confirmVisible: (id: string, evidence: KitEvidence) => Promise<boolean>;
  reserve: (location: string, orderId: string, rowId: string) => Promise<boolean>;
  send: (email: ReturnType<typeof kitEmail>) => Promise<{ ok: boolean; messageId?: string | null }>;
  finishDelivery: (orderId: string, status: 'sent' | 'uncertain', messageId: string | null) => Promise<void>;
  finishClaim: (orderId: string, status: 'sent' | 'uncertain', messageId: string | null, rowId: string | null) => Promise<void>;
  verifyResult: (orderId: string, rowId: string, status: 'sent' | 'uncertain', messageId: string | null) => Promise<boolean>;
};

async function signature(secret: string, facts: unknown, expires: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(JSON.stringify([facts, expires]))));
  return Array.from(bytes, v => v.toString(16).padStart(2, '0')).join('');
}
function equalHex(a: string, b: string) {
  if (!/^[a-f0-9]{64}$/.test(a) || b.length !== a.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export async function manualKitRecovery(action: 'preview' | 'confirm', raw: ManualRequest, opts: {
  adminId: string; secret: string; previewToken?: string; previewExpires?: number; confirmText?: string;
}, deps: ManualDeps) {
  const input = normalizeManualRequest(raw);
  const { evidence, order } = await deps.readFresh(input);
  const reason = qualifyManualKit(evidence, input, order);
  if (reason) return { status: 'blocked', reason };
  await deps.checkExisting(input.order_id, input.payment_id);
  const facts = manualPreviewFacts(evidence, input, order);
  const bound = { ...facts, admin_id: opts.adminId };
  if (action === 'preview') {
    const expires = Date.now() + 5 * 60_000;
    return { status: 'ready', facts, preview_expires: expires,
      preview_token: await signature(opts.secret, bound, expires), writes: 0, outbound_messages: 0 };
  }
  if (opts.confirmText !== 'SEND ONE KIT TO NEW TIMES' || !opts.previewExpires ||
    opts.previewExpires < Date.now() || opts.previewExpires > Date.now() + 5 * 60_000 ||
    !equalHex(opts.previewToken ?? '', await signature(opts.secret, bound, opts.previewExpires))) {
    return { status: 'blocked', reason: 'preview_changed_or_expired' };
  }
  // Claim is permanent. Any failure after this point is held for reconciliation.
  await deps.claim(facts, opts.adminId);
  let rowId: string | null = null;
  let reserved = false;
  try {
    await deps.checkExisting(input.order_id, input.payment_id);
    const row = kitOrderRow({ ...evidence, shipping: input.shipping });
    row.order_details = { ...row.order_details, shipping_source: 'admin_confirmed',
      manual_kit_recovery: { admin_id: opts.adminId, release_basis: input.release_basis,
        address_evidence: input.address_evidence, reason: input.reason, verified_payment_minor: evidence.payment.receivedMinor,
        ghl_payment_status: order.paymentStatus } } as typeof row.order_details;
    rowId = await deps.ensureRow(row);
    if (!await deps.confirmVisible(rowId, { ...evidence, shipping: input.shipping })) throw new Error('supplier_page_visibility_unverified');
    reserved = await deps.reserve(KIT_LOCATION, input.order_id, rowId);
    if (!reserved) throw new Error('existing_supplier_delivery');
    const sent = await deps.send(kitEmail(input.order_id, { ...evidence, shipping: input.shipping }));
    const outcome = sent.ok && sent.messageId ? 'sent' : 'uncertain';
    await deps.finishDelivery(input.order_id, outcome, sent.messageId ?? null);
    await deps.finishClaim(input.order_id, outcome, sent.messageId ?? null, rowId);
    if (!await deps.verifyResult(input.order_id, rowId, outcome, sent.messageId ?? null))
      return { status: 'uncertain', reason: 'saved_result_unverified', order_id: input.order_id };
    return { status: outcome, order_id: input.order_id, supplier_message_id: sent.messageId ?? null, row_id: rowId };
  } catch {
    if (reserved) await deps.finishDelivery(input.order_id, 'uncertain', null).catch(() => {});
    await deps.finishClaim(input.order_id, 'uncertain', null, rowId).catch(() => {});
    return { status: 'uncertain', reason: 'manual_reconciliation_required', order_id: input.order_id };
  }
}
