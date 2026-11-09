import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KIT_ITEMS } from '../../../supabase/functions/_shared/hairSystemKit/logic';

type Fields = { request_key: string; name: string; email: string; phone: string;
  shipping: { address1: string; address2: string; city: string; state: string; postal_code: string; country: string };
  kit_notes: string; reason: string; address_evidence: string; shipping_confirmed: boolean };
const blank = (): Fields => ({ request_key: crypto.randomUUID(), name: '', email: '', phone: '',
  shipping: { address1: '', address2: '', city: '', state: '', postal_code: '', country: 'US' },
  kit_notes: '', reason: '', address_evidence: '', shipping_confirmed: false });
type Preview = { status: 'ready'; facts: Record<string, unknown>; preview_token: string; preview_expires: number };

export function ManualKitRecovery() {
  const [fields, setFields] = useState<Fields>(blank);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const invalidatePreview = () => { setPreview(null); setMessage(''); };
  const change = (key: keyof Fields, value: unknown) => { setFields(v => ({ ...v, [key]: value })); invalidatePreview(); };
  const shipping = (key: keyof Fields['shipping'], value: string) => {
    setFields(v => ({ ...v, shipping: { ...v.shipping, [key]: value } })); invalidatePreview();
  };
  const invoke = async (action: 'manual_preview' | 'manual_confirm') => {
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('hair-system-kit', { body: {
        ...fields, shipping_confirmed: fields.shipping_confirmed === true, action,
        ...(action === 'manual_confirm' ? { preview_token: preview?.preview_token,
          preview_expires: preview?.preview_expires } : {}),
      } });
      if (error) {
        const body = await (error as { context?: Response }).context?.json().catch(() => null);
        throw new Error(body?.reason ?? body?.error ?? 'The recovery check failed.');
      }
      if (action === 'manual_preview') {
        if (data?.status !== 'ready') throw new Error(data?.reason ?? 'This kit is blocked.');
        setPreview(data as Preview);
        setMessage('Preview ready. Review the entered facts and supplier action below.');
      } else {
        setPreview(null);
        setMessage(data?.status === 'sent' && data?.supplier_message_id
          ? `Supplier email sent once. Message ID: ${data.supplier_message_id}`
          : 'Outcome is uncertain. Reconcile the saved claim and delivery before further action.');
        await queryClient.invalidateQueries({ queryKey: ['orders', 'all'] });
      }
    } catch (error) {
      if (action === 'manual_confirm') setPreview(null);
      setMessage(`${error instanceof Error ? error.message : 'Recovery check failed.'}${action === 'manual_confirm'
        ? ' Check the permanent claim, supplier order and delivery before further action.' : ''}`);
    } finally { setBusy(false); }
  };
  return <Card><CardContent className="space-y-4 p-5">
    <div><h2 className="text-xl font-semibold">Enter a hair system kit manually</h2>
      <p className="text-sm text-muted-foreground">Enter the buyer and shipping details exactly as confirmed. No payment or GHL order ID is needed. Preview makes no changes.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      {(['name','email','phone'] as const).map(key => <label key={key} className="text-sm">{key}
        <Input value={fields[key]} onChange={e => change(key, e.target.value)} /></label>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {(['address1','address2','city','state','postal_code','country'] as const).map(key =>
        <label key={key} className="text-sm">Shipping {key.replace(/_/g,' ')}
          <Input value={fields.shipping[key]} onChange={e => shipping(key, e.target.value)} /></label>)}
    </div>
    <div className="text-sm"><strong>Kit contents</strong><ul className="list-disc pl-5">{KIT_ITEMS.map(item => <li key={item}>{item}</li>)}</ul></div>
    <label className="block text-sm">Kit details or supplier notes
      <textarea className="mt-1 min-h-20 w-full rounded-md border bg-background p-2" value={fields.kit_notes}
        onChange={e => change('kit_notes', e.target.value)} /></label>
    <label className="block text-sm">Who confirmed this shipping address?
      <textarea className="mt-1 min-h-20 w-full rounded-md border bg-background p-2" value={fields.address_evidence}
        onChange={e => change('address_evidence', e.target.value)} /></label>
    <label className="block text-sm">Reason for manual entry
      <textarea className="mt-1 min-h-20 w-full rounded-md border bg-background p-2" value={fields.reason}
        onChange={e => change('reason', e.target.value)} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fields.shipping_confirmed}
      onChange={e => change('shipping_confirmed', e.target.checked)} /> I confirmed this is the complete shipping destination for this kit.</label>
    <Button disabled={busy} onClick={() => invoke('manual_preview')}>Review manual kit</Button>
    {preview && <div className="space-y-3 rounded-md border p-4 text-sm">
      <p className="font-semibold">Review before sending one supplier email</p>
      <p><strong>Buyer:</strong> {fields.name} · {fields.email} · {fields.phone}</p>
      <p><strong>Ship to:</strong> {[fields.shipping.address1, fields.shipping.address2, fields.shipping.city,
        fields.shipping.state, fields.shipping.postal_code, fields.shipping.country].filter(Boolean).join(', ')}</p>
      <p><strong>Kit:</strong> {KIT_ITEMS.join(' · ')}</p>
      {fields.kit_notes && <p><strong>Supplier notes:</strong> {fields.kit_notes}</p>}
      <p><strong>Action:</strong> Create one kit order and email New Times Hair at sales30@newtimeshair.com.</p>
      <p>This review expires after five minutes.</p>
      <Button disabled={busy} onClick={() => invoke('manual_confirm')}>Create kit and send supplier email</Button>
    </div>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {message.includes('Message ID:') && <Button variant="outline" onClick={() => { setFields(blank()); setPreview(null); setMessage(''); }}>Start another manual kit</Button>}
  </CardContent></Card>;
}
