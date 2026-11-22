import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useMemberBilling } from '@/hooks/useMemberBilling';
import { cardLabel, paymentChoiceFor, usableCards, type DomainPaymentChoice } from '@/lib/memberBilling';

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
  onBuy: (payment: DomainPaymentChoice) => void;
  result: DomainResult | null;
  order: DomainOrder | null;
  busy: string;
  previewOnly: boolean;
};

export function DomainSetupStep({ currentDomain, input, onInput, onCheck, onBuy, result, order, busy, previewOnly }: Props) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onCheck(); };
  const canBuy = !!result?.available && result.price !== null && !previewOnly && !currentDomain;
  const billing = useMemberBilling(canBuy);
  const cards = usableCards(billing.data?.cards ?? []);
  const [selection, setSelection] = useState('new');
  const [saveNewCard, setSaveNewCard] = useState(false);
  useEffect(() => {
    // Never preselect a saved card; the member chooses it explicitly for this purchase.
    if (selection !== 'new' && !cards.some(card => card.id === selection)) setSelection('new');
  }, [cards, selection]);
  const choice = paymentChoiceFor(selection, saveNewCard, cards);
  const selectedCard = choice.method === 'saved' ? cards.find(card => card.id === choice.paymentMethodId) : undefined;
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
          {!previewOnly && <div className="mt-4 border-t pt-4"><fieldset className="space-y-3" disabled={!!busy}>
            <legend className="mb-3 text-sm font-medium">How would you like to pay?</legend>
            {billing.isLoading && <p className="text-sm text-muted-foreground">Checking your saved cards…</p>}
            {cards.map(card => <label key={card.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-[:checked]:border-primary">
              <input type="radio" name="domain-payment" className="mt-1 accent-primary" checked={selection === card.id} onChange={() => setSelection(card.id)} />
              <span>Saved card: {cardLabel(card)}</span>
            </label>)}
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-[:checked]:border-primary">
              <input type="radio" name="domain-payment" className="mt-1 accent-primary" checked={selection === 'new'} onChange={() => setSelection('new')} />
              <span>Use a new card</span>
            </label>
            {selection === 'new' && <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <Checkbox className="mt-0.5" checked={saveNewCard} onCheckedChange={value => setSaveNewCard(value === true)} />
              <span>Save this card for future Barber Launch purchases. It is only charged when you choose it and confirm.</span>
            </label>}
            {billing.data?.customer.status === 'unresolved' && <p className="text-xs text-muted-foreground">Cards from past purchases are hidden because we couldn't confirm they belong only to your account.</p>}
            {billing.isError && <p className="text-xs text-muted-foreground">Saved cards couldn't be loaded. You can still pay with a new card.</p>}
            <div className="rounded-md border border-primary/50 bg-primary/10 p-3 text-sm" aria-live="polite">
              <p><strong>{result.domain}</strong> · 1-year registration</p>
              <p className="mt-1 text-base font-semibold">Total today: {money(result.price, result.currency)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Automatic renewal is off. {selectedCard
                ? `On Stripe's secure page, select the card ending ${selectedCard.last4} and confirm.`
                : "You'll enter your card on Stripe's secure page."}</p>
            </div>
            <Button type="button" className="w-full sm:w-auto" disabled={!!busy} onClick={() => onBuy(choice)}>
              {busy === 'Opening checkout' ? 'Opening secure checkout…' : `Pay ${money(result.price, result.currency)} for ${result.domain}`}
            </Button>
            <p className="text-xs text-muted-foreground">Manage saved cards on your <Link to="/billing" className="underline">Billing</Link> page.</p>
          </fieldset></div>}
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
