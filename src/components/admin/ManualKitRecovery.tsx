import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Fields = { order_id: string; payment_id: string; contact_id: string; release_basis: 'fully_paid' | 'installment_entitlement' | 'admin_entitlement';
  shipping: { name: string; address1: string; address2: string; city: string; state: string; postal_code: string; country: string };
  address_evidence: string; reason: string; shipping_confirmed: boolean };
const empty: Fields = { order_id: '', payment_id: '', contact_id: '', release_basis: 'fully_paid',
  shipping: { name: '', address1: '', address2: '', city: '', state: '', postal_code: '', country: 'US' },
  address_evidence: '', reason: '', shipping_confirmed: false };
type Preview = { status: 'ready'; facts: Record<string, unknown>; preview_token: string; preview_expires: number };

export function ManualKitRecovery() {
  const [fields, setFields] = useState<Fields>(empty);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const change = (key: keyof Fields, value: unknown) => { setFields(v => ({ ...v, [key]: value })); setPreview(null); setConfirmText(''); setMessage(''); };
  const shipping = (key: keyof Fields['shipping'], value: string) => {
    setFields(v => ({ ...v, shipping: { ...v.shipping, [key]: value } })); setPreview(null); setConfirmText(''); setMessage('');
  };
  const invoke = async (action: 'manual_preview' | 'manual_confirm') => {
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('hair-system-kit', { body: {
        ...fields, shipping_confirmed: fields.shipping_confirmed === true, action,
        ...(action === 'manual_confirm' ? { preview_token: preview?.preview_token,
          preview_expires: preview?.preview_expires, confirm_text: confirmText } : {}),
      } });
      if (error) {
        const body = await (error as { context?: Response }).context?.json().catch(() => null);
        throw new Error(body?.reason ?? body?.error ?? 'The recovery check failed. No send is confirmed.');
      }
      if (action === 'manual_preview') {
        if (data?.status !== 'ready') throw new Error(data?.reason ?? 'This kit is blocked.');
        setPreview(data as Preview);
        setConfirmText('');
        setMessage('Preview ready. Review the exact order, address, payment and supplier action below.');
      } else {
        setPreview(null);
        setMessage(data?.status === 'sent' && data?.supplier_message_id
          ? `Supplier email sent once. Message ID: ${data.supplier_message_id}`
          : 'Outcome is uncertain. Reconcile the saved claim and delivery before taking further action.');
        await queryClient.invalidateQueries({ queryKey: ['orders', 'all'] });
      }
    } catch (error) {
      if (action === 'manual_confirm') setPreview(null);
      setMessage(`${error instanceof Error ? error.message : 'Recovery check failed.'}${action === 'manual_confirm'
        ? ' Check the permanent claim, supplier order and delivery status before any further action.' : ''}`);
    }
    finally { setBusy(false); }
  };
  return <Card><CardContent className="space-y-4 p-5">
    <div><h2 className="text-xl font-semibold">Manual hair system kit recovery</h2>
      <p className="text-sm text-muted-foreground">One verified GHL enrollment at a time. Preview makes no changes. Confirmation creates one supplier order and sends one initial email to New Times.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      {(['order_id','payment_id','contact_id'] as const).map(key => <label key={key} className="text-sm">{key.replace(/_/g,' ')}
        <Input value={fields[key]} onChange={e => change(key, e.target.value)} /></label>)}
    </div>
    <label className="block text-sm">Release basis
      <select className="mt-1 w-full rounded-md border bg-background p-2" value={fields.release_basis}
        onChange={e => change('release_basis', e.target.value)}>
        <option value="fully_paid">Full enrollment payment</option>
        <option value="installment_entitlement">Verified enrollment installment of at least $800</option>
        <option value="admin_entitlement">Owner-approved manual entitlement for this exact order</option>
      </select></label>
    <div className="grid gap-3 sm:grid-cols-3">
      {(['name','address1','address2','city','state','postal_code','country'] as const).map(key =>
        <label key={key} className="text-sm">Shipping {key.replace(/_/g,' ')}
          <Input value={fields.shipping[key]} onChange={e => shipping(key, e.target.value)} /></label>)}
    </div>
    <label className="block text-sm">Address evidence and source
      <textarea className="mt-1 min-h-20 w-full rounded-md border bg-background p-2" value={fields.address_evidence}
        onChange={e => change('address_evidence', e.target.value)} placeholder="Who confirmed this shipping address for this purchase, and where?" /></label>
    <label className="block text-sm">Reason for manual release
      <textarea className="mt-1 min-h-20 w-full rounded-md border bg-background p-2" value={fields.reason}
        onChange={e => change('reason', e.target.value)} placeholder="Why this paid enrollment needs a kit now" /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fields.shipping_confirmed}
      onChange={e => change('shipping_confirmed', e.target.checked)} /> I confirmed this complete shipping destination for this exact order.</label>
    <Button disabled={busy} onClick={() => invoke('manual_preview')}>Preview with fresh payment and delivery checks</Button>
    {preview && <div className="space-y-3 rounded-md border p-4 text-sm">
      <p className="font-semibold">Review before supplier send</p>
      <pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(preview.facts, null, 2)}</pre>
      <p>Type <strong>SEND ONE KIT TO NEW TIMES</strong> to confirm. The preview expires after five minutes.</p>
      <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} />
      <Button disabled={busy || confirmText !== 'SEND ONE KIT TO NEW TIMES'} onClick={() => invoke('manual_confirm')}>Create order and send supplier email</Button>
    </div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </CardContent></Card>;
}
