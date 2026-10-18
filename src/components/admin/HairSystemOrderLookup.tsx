import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildReceiptPdf } from '@/lib/orderReceipt';
import { withNativeReceipt, type NativeReceiptResult } from '@/lib/nativeOrderReceipt';
import type { Tables } from '@/integrations/supabase/types';
import { Search, Download } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';

type FoundOrder = Tables<'orders'> & { supplier_delivery: { status: string; attempts: number; reason?: string; updated_at?: string }; supplier_error?: string };
async function read(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('hair-system-order-details', { body });
  if (error instanceof FunctionsHttpError) {
    const details = await error.context.json().catch(() => null);
    throw new Error(details?.error ?? 'Order details unavailable.');
  }
  if (error || data?.error) throw new Error(data?.error ?? error?.message);
  return data;
}

export function HairSystemOrderLookup() {
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('2026-10-14');
  const [orders, setOrders] = useState<FoundOrder[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const search = async () => {
    setBusy(true); setError(''); setOrders(null);
    try { setOrders((await read({ action: 'search', email: email.trim(), date })).orders); }
    catch (e) { setError(e instanceof Error ? e.message : 'Order details unavailable.'); }
    finally { setBusy(false); }
  };
  const receipt = async (order: FoundOrder) => {
    setBusy(true); setError('');
    try {
      const result = await read({ action: 'receipt', order_id: order.id }) as NativeReceiptResult;
      buildReceiptPdf(withNativeReceipt(order, result)).save(`checkout-receipt-${order.id}.pdf`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Paid amount unavailable.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 border-t border-border pt-4">
    <h4 className="font-semibold">Order details · read-only</h4>
    <div className="flex flex-wrap gap-2">
      <Input type="email" aria-label="Buyer email" placeholder="Buyer email" value={email} onChange={(e) => setEmail(e.target.value)} className="sm:max-w-xs" />
      <Input type="date" aria-label="Order date (UTC)" value={date} onChange={(e) => setDate(e.target.value)} className="sm:max-w-48" />
      <Button variant="outline" onClick={search} disabled={busy || !email.trim() || !date}><Search className="mr-2 h-4 w-4" />Find orders</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {orders?.length === 0 && <p className="text-sm text-muted-foreground">No orders found for that email and UTC date.</p>}
    {orders?.map((order) => <article key={order.id} className="space-y-2 border-t border-border py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{order.customer_name} · {order.order_date}</strong><Button variant="outline" size="sm" disabled={busy || !order.stripe_checkout_session_id} onClick={() => receipt(order)}><Download className="mr-2 h-4 w-4" />Verified checkout receipt</Button></div>
      <p className="break-all">Order ID: {order.id}</p><p>{order.customer_email} · Stored status: {order.status}</p>
      <p>Supplier: {order.supplier_error ?? `${order.supplier_delivery?.status ?? 'unavailable'} · attempts ${order.supplier_delivery?.attempts ?? 'unavailable'}`}</p>
      {order.supplier_delivery?.reason && <p className="break-words text-muted-foreground">{order.supplier_delivery.reason}</p>}
      {order.supplier_delivery?.updated_at && <p>Last attempt: {order.supplier_delivery.updated_at}</p>}
      <dl className="space-y-1">{Object.entries((order.order_details ?? {}) as Record<string, unknown>).filter(([key]) => !['stripe_receipt', 'checkout_system_details'].includes(key)).map(([key, value]) => <div key={key} className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)]"><dt className="text-muted-foreground">{key}</dt><dd className="whitespace-pre-wrap break-words">{typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value ?? '—')}</dd></div>)}</dl>
    </article>)}
  </section>;
}