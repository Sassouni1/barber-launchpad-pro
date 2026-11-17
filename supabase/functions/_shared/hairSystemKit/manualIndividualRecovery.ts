import { equalHex, signature } from './manualRecovery.ts';
import { individualEmail, individualFacts, individualFingerprint, individualRow, validateIndividual, type IndividualInput } from './manualIndividual.ts';
export { individualEmail, individualFingerprint, individualRow, validateIndividual } from './manualIndividual.ts';

export type IndividualDeps = {
  checkExisting: (input: IndividualInput, fingerprint: string) => Promise<void>;
  claim: (facts: ReturnType<typeof individualFacts>, adminId: string) => Promise<boolean>;
  createRow: (row: ReturnType<typeof individualRow>) => Promise<string>;
  verifyVisible: (rowId: string, row: ReturnType<typeof individualRow>) => Promise<boolean>;
  reserveDelivery: (key: string, rowId: string) => Promise<boolean>;
  send: (mail: ReturnType<typeof individualEmail>) => Promise<{ ok: boolean; messageId?: string | null }>;
  finishDelivery: (key: string, status: 'sent' | 'uncertain', messageId: string | null) => Promise<void>;
  finishClaim: (key: string, status: 'sent' | 'uncertain', messageId: string | null, rowId: string | null) => Promise<void>;
  verifyResult: (key: string, rowId: string, status: 'sent' | 'uncertain', messageId: string | null) => Promise<boolean>;
};

export async function manualIndividualRecovery(action: 'preview' | 'confirm', input: IndividualInput,
  opts: { adminId: string; secret: string; previewToken?: string; previewExpires?: number }, deps: IndividualDeps) {
  const invalid = validateIndividual(input);
  if (invalid) return { status: 'blocked', reason: invalid };
  const fingerprint = await individualFingerprint(input);
  const key = `individual:${fingerprint}:${input.repeat_of_order_id ?? 'first'}`;
  await deps.checkExisting(input, fingerprint);
  const facts = individualFacts(input, fingerprint);
  const bound = { ...facts, admin_id: opts.adminId };
  if (action === 'preview') {
    const expires = Date.now() + 5 * 60_000;
    return { status: 'ready', facts, preview_expires: expires,
      preview_token: await signature(opts.secret, bound, expires), writes: 0, outbound_messages: 0 };
  }
  if (!opts.previewExpires || opts.previewExpires < Date.now() || opts.previewExpires > Date.now() + 5 * 60_000 ||
    !equalHex(opts.previewToken ?? '', await signature(opts.secret, bound, opts.previewExpires)))
    return { status: 'blocked', reason: 'preview_changed_or_expired' };
  if (!await deps.claim(facts, opts.adminId)) return { status: 'blocked', reason: 'prior_individual_claim_requires_reconciliation' };
  let rowId: string | null = null; let reserved = false;
  try {
    await deps.checkExisting(input, fingerprint);
    const row = individualRow(input, opts.adminId, fingerprint);
    rowId = await deps.createRow(row);
    if (!await deps.verifyVisible(rowId, row)) throw Error('supplier_row_unverified');
    reserved = await deps.reserveDelivery(key, rowId);
    if (!reserved) throw Error('delivery_already_reserved');
    const sent = await deps.send(individualEmail(input, rowId));
    const outcome = sent.ok && sent.messageId ? 'sent' : 'uncertain';
    await deps.finishDelivery(key, outcome, sent.messageId ?? null);
    await deps.finishClaim(key, outcome, sent.messageId ?? null, rowId);
    if (!await deps.verifyResult(key, rowId, outcome, sent.messageId ?? null))
      return { status: 'uncertain', reason: 'saved_result_unverified' };
    return { status: outcome, row_id: rowId, supplier_message_id: sent.messageId ?? null };
  } catch {
    if (reserved) await deps.finishDelivery(key, 'uncertain', null).catch(() => {});
    await deps.finishClaim(key, 'uncertain', null, rowId).catch(() => {});
    return { status: 'uncertain', reason: 'manual_reconciliation_required' };
  }
}
