import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, CircleX, Link2, Search } from 'lucide-react';
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
  suggestions: DomainResult[];
  findingSuggestions: boolean;
  onSelectSuggestion: (result: DomainResult) => void;
  selectedDomain: string;
  onSelectDomain: (domain: string) => void;
  order: DomainOrder | null;
  busy: string;
  previewOnly: boolean;
  onSkip: () => void;
};

export function DomainSetupStep({ currentDomain, input, onInput, onCheck, onBuy, result, suggestions, findingSuggestions, onSelectSuggestion, selectedDomain, onSelectDomain, order, busy, previewOnly, onSkip }: Props) {
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

  return <div className="mx-auto max-w-4xl space-y-7">
    <div>
      <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">Choose your domain</h2>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">Search for the address clients will use to open your website. You can add one later if you’re still deciding.</p>
    </div>
    {currentDomain ? <div className="rounded-lg border border-primary/50 bg-primary/10 p-4">
      <strong>{currentDomain}</strong>
      <p className="mt-1 text-sm text-muted-foreground">This domain is saved for your website. Publish the site to connect it.</p>
    </div> : <>
      {previewOnly && selectedDomain && !result && <div className="rounded-lg border border-primary/50 bg-primary/10 p-4"><p className="text-sm font-semibold text-primary">Selected for your draft</p><strong className="mt-1 block break-all">{selectedDomain}</strong><p className="mt-1 text-xs text-muted-foreground">This domain has not been purchased or reserved.</p></div>}
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
        <div className="relative min-w-0 flex-1"><Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Domain name" value={input} onChange={event => onInput(event.target.value)} placeholder="yourbarbershop.com" autoComplete="off" className="h-14 border-border/80 bg-muted/50 pl-12 text-base focus-visible:ring-primary" /></div>
        <Button type="submit" variant="outline" disabled={!!busy} className="h-14 border-primary px-7 text-base font-semibold text-foreground hover:bg-primary/10 hover:text-foreground">{busy === 'Checking' ? 'Checking…' : 'Search'}</Button>
      </form>
      {result && <div className={`rounded-lg border p-4 ${!result.available ? 'border-red-500/80 bg-red-950/40' : ''}`} aria-live="polite">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="break-all">{result.domain}</strong>
          {!result.available && <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white"><CircleX className="h-3.5 w-3.5" />Not available</span>}
        </div>
        {result.available && result.price !== null ? <>
          <p className="mt-2">Available · {money(result.price, result.currency)} for the first year</p>
          {result.renewalPrice !== null && <p className="text-sm text-muted-foreground">Current renewal price: {money(result.renewalPrice, result.currency)}. Automatic renewal is off.</p>}
          {previewOnly && <div className="mt-4 space-y-2"><Button type="button" variant={selectedDomain === result.domain ? 'default' : 'outline'} onClick={() => onSelectDomain(result.domain)} className="w-full border-primary sm:w-auto">{selectedDomain === result.domain ? 'Selected for your draft' : 'Select this domain'}</Button><p className="text-xs text-muted-foreground">Selecting saves the name for this draft. It does not purchase or reserve the domain.</p></div>}
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
              {busy === 'Opening checkout' ? 'Opening secure checkout…' : 'Purchase domain'}
            </Button>
            <p className="text-xs text-muted-foreground">Manage saved cards on your <Link to="/billing" className="underline">Billing</Link> page.</p>
          </fieldset></div>}
          {previewOnly && <p className="mt-2 text-sm text-muted-foreground">Purchase is disabled in this preview.</p>}
        </> : <p className={`mt-2 text-sm font-medium ${!result.available ? 'text-red-200' : 'text-muted-foreground'}`}>{result.available ? 'We could not get a price for this domain. Please search again later.' : 'This domain is already taken. Try another name.'}</p>}
      </div>}
      {result && !result.available && (findingSuggestions || suggestions.length > 0) && <div className="space-y-3 rounded-lg border border-primary/40 p-4" aria-live="polite">
        <h3 className="font-semibold">Available alternatives</h3>
        {findingSuggestions ? <p className="text-sm text-muted-foreground">Checking similar names…</p> : <div className="grid gap-2">{suggestions.map(item => <button key={item.domain} type="button" onClick={() => onSelectSuggestion(item)} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-3 text-left hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="min-w-0 break-all text-sm font-medium sm:text-base">{item.domain}</span><span className="shrink-0 text-sm text-primary">{money(item.price!, item.currency)} · Select →</span></button>)}</div>}
        <p className="text-xs text-muted-foreground">Availability and price are checked again before purchase.</p>
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
      <div className="border-t border-border/70 pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary"><Link2 className="h-5 w-5" /></span><div><p className="font-serif text-lg font-semibold">Decide on a domain later</p><p className="mt-1 text-sm text-muted-foreground">You can finish the rest of your website setup now.</p></div></div>
          <Button type="button" variant="outline" onClick={onSkip} className="h-11 shrink-0 border-primary/60 px-5 text-primary hover:bg-primary/10 hover:text-primary">Skip domain<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>
      </div>
    </>}
  </div>;
}
