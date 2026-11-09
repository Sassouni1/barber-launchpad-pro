import { manualFacts, manualIdentityKey, manualKitEmail, manualOrderRow, validateManualKit, type ManualKitInput } from './manual.ts';

export type ManualDeps = {
  checkExisting: (input: ManualKitInput, identityKey: string) => Promise<void>;
  checkClaim: (identityKey: string) => Promise<boolean>;
  claim: (facts: ReturnType<typeof manualFacts>, adminId: string) => Promise<boolean>;
  createRow: (row: ReturnType<typeof manualOrderRow>) => Promise<string>;
  verifyVisible: (rowId: string, row: ReturnType<typeof manualOrderRow>) => Promise<boolean>;
  reserveDelivery: (identityKey: string, rowId: string) => Promise<boolean>;
  send: (mail: ReturnType<typeof manualKitEmail>) => Promise<{ ok: boolean; messageId?: string | null }>;
  finishDelivery: (identityKey: string, status: 'sent' | 'uncertain', messageId: string | null) => Promise<void>;
  finishClaim: (identityKey: string, status: 'sent' | 'uncertain', messageId: string | null, rowId: string | null) => Promise<void>;
  verifyResult: (identityKey: string, rowId: string, status: 'sent' | 'uncertain', messageId: string | null) => Promise<boolean>;
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

export async function manualKitRecovery(action: 'preview' | 'confirm', input: ManualKitInput, opts: {
  adminId: string; secret: string; previewToken?: string; previewExpires?: number;
}, deps: ManualDeps) {
  const invalid = validateManualKit(input);
  if (invalid) return { status: 'blocked', reason: invalid };
  const identityKey = await manualIdentityKey(input);
  if (await deps.checkClaim(identityKey)) return { status: 'blocked', reason: 'prior_manual_claim_requires_reconciliation' };
  await deps.checkExisting(input, identityKey);
  const facts = manualFacts(input, identityKey);
  const bound = { ...facts, admin_id: opts.adminId };
  if (action === 'preview') {
    const expires = Date.now() + 5 * 60_000;
    return { status: 'ready', facts, preview_expires: expires,
      preview_token: await signature(opts.secret, bound, expires), writes: 0, outbound_messages: 0 };
  }
  if (!opts.previewExpires ||
    opts.previewExpires < Date.now() || opts.previewExpires > Date.now() + 5 * 60_000 ||
    !equalHex(opts.previewToken ?? '', await signature(opts.secret, bound, opts.previewExpires)))
    return { status: 'blocked', reason: 'preview_changed_or_expired' };
  // Unique identity claim is inserted before the order and supplier send.
  if (!await deps.claim(facts, opts.adminId)) return { status: 'blocked', reason: 'prior_manual_claim_requires_reconciliation' };
  let rowId: string | null = null;
  let reserved = false;
  try {
    await deps.checkExisting(input, identityKey);
    const row = manualOrderRow(input, opts.adminId, identityKey);
    rowId = await deps.createRow(row);
    if (!await deps.verifyVisible(rowId, row)) throw new Error('supplier_row_unverified');
    reserved = await deps.reserveDelivery(identityKey, rowId);
    if (!reserved) throw new Error('delivery_already_reserved');
    const sent = await deps.send(manualKitEmail(input, rowId));
    const outcome = sent.ok && sent.messageId ? 'sent' : 'uncertain';
    await deps.finishDelivery(identityKey, outcome, sent.messageId ?? null);
    await deps.finishClaim(identityKey, outcome, sent.messageId ?? null, rowId);
    if (!await deps.verifyResult(identityKey, rowId, outcome, sent.messageId ?? null))
      return { status: 'uncertain', reason: 'saved_result_unverified' };
    return { status: outcome, row_id: rowId, supplier_message_id: sent.messageId ?? null,
      external_reference: facts.external_reference };
  } catch {
    if (reserved) await deps.finishDelivery(identityKey, 'uncertain', null).catch(() => {});
    await deps.finishClaim(identityKey, 'uncertain', null, rowId).catch(() => {});
    return { status: 'uncertain', reason: 'manual_reconciliation_required' };
  }
}
