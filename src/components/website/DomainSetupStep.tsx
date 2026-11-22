import { type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type DomainResult = {
  domain: string; available: boolean; price: number | null;
  renewalPrice: number | null; currency: string; reason: string | null;
};
export type DomainOrder = {
  id: string; domain: string; status: string;
  member_charge_cents: number; last_error: string | null;
};

type Props = {
  currentDomain: string | null;
  input: string;
  onInput: (value: string) => void;
  onCheck: () => void;
  onBuy: () => void;
  result: DomainResult | null;
  order: DomainOrder | null;
  busy: string;
  previewOnly: boolean;
};

export function DomainSetupStep({ currentDomain, input, onInput, onCheck, onBuy, result, order, busy, previewOnly }: Props) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onCheck(); };
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return <div className="max-w-xl space-y-5">
    <div>
      <h2 className="font-serif text-2xl">Choose your domain</h2>
      <p className="mt-2 text-sm text-muted-foreground">Search for the address clients will use to open your website. You can also continue with a free temporary address.</p>
    </div>
    {currentDomain ? <div className="rounded-lg border border-primary/50 bg-primary/10 p-4">
      <strong>{currentDomain}</strong>
      <p className="mt-1 text-sm text-muted-foreground">This domain is saved for your website. Publish the site to connect it.</p>
    </div> : <>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
        <Input aria-label="Domain name" value={input} onChange={event => onInput(event.target.value)} placeholder="yourshop.com" autoComplete="off" />
        <Button type="submit" variant="outline" disabled={!!busy}>{busy === 'Checking' ? 'Checking…' : 'Search'}</Button>
      </form>
      {result && <div className="rounded-lg border p-4" aria-live="polite">
        <strong>{result.domain}</strong>
        {result.available && result.price !== null ? <>
          <p className="mt-2">Available · {money(result.price, result.currency)} for the first year</p>
          {result.renewalPrice !== null && <p className="text-sm text-muted-foreground">Current renewal price: {money(result.renewalPrice, result.currency)}. Automatic renewal is off.</p>}
          {!previewOnly && <Button type="button" className="mt-4" disabled={!!busy} onClick={onBuy}>Pay and reserve {result.domain}</Button>}
          {previewOnly && <p className="mt-2 text-sm text-muted-foreground">Purchase is disabled in this preview.</p>}
        </> : <p className="mt-2 text-sm text-muted-foreground">{result.reason || 'This domain is unavailable.'}</p>}
      </div>}
      {order && <div className="rounded-lg border p-4" aria-live="polite">
        <strong>{order.domain}</strong>
        <p className="mt-1 text-sm">{order.status === 'registered'
          ? 'Purchased and ready to connect when you publish.'
          : order.status === 'checkout_open'
            ? 'Checkout is unfinished. Search this domain again to resume payment.'
            : order.status === 'checkout_pending'
              ? 'Preparing your checkout. Refresh this page in a moment.'
          : order.status === 'action_required'
            ? 'Your payment or registration needs a manual review. Contact support before trying again.'
            : 'Checkout or registration is still processing.'}</p>
        {order.last_error && <p className="mt-1 text-sm text-destructive">{order.last_error}</p>}
      </div>}
    </>}
  </div>;
}
