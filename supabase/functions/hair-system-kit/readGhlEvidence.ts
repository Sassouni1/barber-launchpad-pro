import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGhlAccess, ghlHeaders, GHL_BASE } from '../_shared/ghlMessaging.ts';
import { evidenceFromGhl } from './ghlEvidence.ts';
import { KIT_LOCATION, type KitEvidence } from './logic.ts';

const ORDER_ID = /^[A-Za-z0-9_-]{1,128}$/;
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};

async function readJson(url: URL, token: string, version: string): Promise<Obj> {
  const response = await fetch(url, { headers: { ...ghlHeaders(token), Version: version } });
  if (!response.ok) throw new Error(`ghl_payment_read_${response.status}`);
  const data = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('ghl_payment_response_invalid');
  return data as Obj;
}

/** A fresh server-side read; never trusts the incoming workflow body as payment proof. */
export async function readGhlEvidence(db: SupabaseClient, orderId: string): Promise<KitEvidence> {
  if (!ORDER_ID.test(orderId)) throw new Error('invalid_ghl_order_id');
  const access = await getGhlAccess(db, { oauthOnly: true });
  if ('error' in access) throw new Error('ghl_oauth_unavailable');
  if (access.locationId !== KIT_LOCATION) throw new Error('ghl_wrong_location');
  const orderUrl = new URL(`/payments/orders/${encodeURIComponent(orderId)}`, GHL_BASE);
  orderUrl.searchParams.set('altType', 'location');
  orderUrl.searchParams.set('altId', KIT_LOCATION);
  orderUrl.searchParams.set('locationId', KIT_LOCATION);
  const transactionsUrl = new URL('/payments/transactions', GHL_BASE);
  transactionsUrl.searchParams.set('altType', 'location');
  transactionsUrl.searchParams.set('altId', KIT_LOCATION);
  transactionsUrl.searchParams.set('locationId', KIT_LOCATION);
  transactionsUrl.searchParams.set('entityId', orderId);
  transactionsUrl.searchParams.set('limit', '100');
  const [orderResponse, transactionResponse] = await Promise.all([
    readJson(orderUrl, access.accessToken, '2021-07-28'), readJson(transactionsUrl, access.accessToken, 'v3'),
  ]);
  const order = obj(orderResponse.data)._id ? obj(orderResponse.data) : orderResponse;
  const envelope = obj(transactionResponse.data);
  const transactions = Array.isArray(envelope.data) ? envelope.data : Array.isArray(transactionResponse.data) ? transactionResponse.data : [];
  const total = typeof envelope.totalCount === 'number' ? envelope.totalCount :
    typeof transactionResponse.totalCount === 'number' ? transactionResponse.totalCount : NaN;
  if (!Number.isSafeInteger(total) || total > transactions.length) throw new Error('ghl_transaction_list_incomplete');
  const succeeded = transactions.filter(raw => obj(raw).status === 'succeeded');
  if (succeeded.length !== 1) throw new Error('ghl_successful_payment_ambiguous_or_missing');
  return evidenceFromGhl(order, succeeded[0]);
}
