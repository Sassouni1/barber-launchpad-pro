import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Fields = { request_key: string; name: string; email: string; phone: string;
  shipping: { address1: string; address2: string; city: string; state: string; postal_code: string; country: string };
  item: string; variant: string; quantity: 1; supplier_cost_cents: number | null;
  notes: string; shipping_confirmed: boolean; repeat_of_order_id: string | null; repeat_confirmed: boolean };
const blank = (): Fields => ({ request_key: crypto.randomUUID(), name: '', email: '', phone: '',
  shipping: { address1: '', address2: '', city: '', state: '', postal_code: '', country: 'US' },
  item: 'Skin hair system', variant: '', quantity: 1, supplier_cost_cents: null, notes: '',
  shipping_confirmed: false, repeat_of_order_id: null, repeat_confirmed: false });
type Preview = { status: 'ready'; preview_token: string; preview_expires: number };

export function ManualIndividualOrder() {
  const [fields, setFields] = useState<Fields>(blank);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const change = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields(current => ({ ...current, [key]: value })); setPreview(null); setMessage('');
  };
  const shipping = (key: keyof Fields['shipping'], value: string) => {
    setFields(current => ({ ...current, shipping: { ...current.shipping, [key]: value } }));
    setPreview(null); setMessage('');
  };
  const invoke = async (action: 'individual_preview' | 'individual_confirm') => {
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('hair-system-kit', { body: {
        ...fields, action,
        ...(action === 'individual_confirm' ? { preview_token: preview?.preview_token,
          preview_expires: preview?.preview_expires } : {}),
      } });
      if (error) {
        const body = await (error as { context?: Response }).context?.json().catch(() => null);
        throw Error(body?.reason ?? body?.error ?? 'Manual order check failed.');
      }
      if (action === 'individual_preview') {
        if (data?.status !== 'ready') throw Error(data?.reason ?? 'Order is blocked for reconciliation.');
        setPreview(data as Preview);
        setMessage('Review the entered order and supplier action below.');
      } else {
        setPreview(null);
        setMessage(data?.status === 'sent' && data?.supplier_message_id
          ? `Supplier email sent once. Message ID: ${data.supplier_message_id}`
          : 'Outcome uncertain. Reconcile the saved order, claim and supplier delivery before retrying.');
        await queryClient.invalidateQueries({ queryKey: ['orders', 'all'] });
      }
    } catch (error) {
      if (action === 'individual_confirm') setPreview(null);
      setMessage(error instanceof Error ? error.message : 'Manual order check failed.');
    } finally { setBusy(false); }
  };
  const cost = fields.supplier_cost_cents === null ? '' : (fields.supplier_cost_cents / 100).toFixed(2);
  return <Card><CardContent className="space-y-4 p-5">
    <div><h2 className="text-xl font-semibold">Enter one hair system manually</h2>
      <p className="text-sm text-muted-foreground">Enter the exact unit and variant. Email, phone and supplier cost are optional; missing cost stays unknown. Review makes no changes.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      {(['name','email','phone'] as const).map(key => <label key={key} className="text-sm">{key}<Input value={fields[key]} onChange={e => change(key, e.target.value)} /></label>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {(['address1','address2','city','state','postal_code','country'] as const).map(key => <label key={key} className="text-sm">Shipping {key.replace(/_/g, ' ')}
        <Input value={fields.shipping[key]} onChange={e => shipping(key, e.target.value)} /></label>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Hair system item<Input value={fields.item} onChange={e => change('item', e.target.value)} /></label>
      <label className="text-sm">Exact variant, color and specifications<Input value={fields.variant} onChange={e => change('variant', e.target.value)} placeholder="e.g. #2 FRO skin unit" /></label>
    </div>
    <p className="text-sm">Quantity: 1 individual hair system</p>
    <label className="block text-sm">Supplier cost in USD, if known<Input type="number" min="0" step="0.01" value={cost}
      onChange={e => change('supplier_cost_cents', e.target.value === '' ? null : Math.round(Number(e.target.value) * 100))} /></label>
    <label className="block text-sm">Supplier notes<textarea className="mt-1 min-h-20 w-full rounded-md border bg-background p-2" value={fields.notes} onChange={e => change('notes', e.target.value)} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fields.shipping_confirmed} onChange={e => change('shipping_confirmed', e.target.checked)} /> I confirmed this complete shipping destination.</label>
    <details className="text-sm"><summary>Intentional later repeat of the same unit</summary>
      <p>For a new later order with identical buyer, destination and unit, enter the prior sent manual order UUID. A retry of that same order must reuse its existing request.</p>
      <Input value={fields.repeat_of_order_id ?? ''} onChange={e => change('repeat_of_order_id', e.target.value || null)} placeholder="Prior order UUID" />
      <label className="flex items-center gap-2"><input type="checkbox" checked={fields.repeat_confirmed} onChange={e => change('repeat_confirmed', e.target.checked)} /> This is a genuinely new later order.</label>
    </details>
    <Button disabled={busy} onClick={() => invoke('individual_preview')}>Review individual order</Button>
    {preview && <div className="space-y-2 rounded-md border p-4 text-sm">
      <p className="font-semibold">Review before supplier notification</p>
      <p><strong>Buyer:</strong> {fields.name} {fields.email && `· ${fields.email}`} {fields.phone && `· ${fields.phone}`}</p>
      <p><strong>Ship to:</strong> {Object.values(fields.shipping).filter(Boolean).join(', ')}</p>
      <p><strong>One unit:</strong> {fields.item} — {fields.variant}</p>
      <p><strong>Supplier cost:</strong> {cost ? `$${cost}` : 'Unknown'}</p>
      {fields.notes && <p><strong>Notes:</strong> {fields.notes}</p>}
      <p><strong>Action:</strong> Create one pending order and email New Times Hair at sales30@newtimeshair.com. No customer payment or checkout is created.</p>
      <Button disabled={busy} onClick={() => invoke('individual_confirm')}>Create order and notify New Times</Button>
    </div>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {message.includes('Message ID:') && <Button variant="outline" onClick={() => { setFields(blank()); setPreview(null); setMessage(''); }}>Start another order</Button>}
  </CardContent></Card>;
}
