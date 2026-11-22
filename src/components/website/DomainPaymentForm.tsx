import { useState, type FormEvent } from 'react';
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from '@stripe/react-stripe-js/checkout';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
let stripePromise: Promise<Stripe | null> | null = null;
const stripe = () => {
  if (!publishableKey) return null;
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
};

type Props = {
  clientSecret: string;
  domain: string;
  price: number;
  currency: string;
  onComplete: () => void;
  onBack: () => void;
};

function PaymentFields({ domain, price, currency, onComplete, onBack }: Omit<Props, 'clientSecret'>) {
  const checkoutState = useCheckoutElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const total = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checkoutState.type !== 'success' || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await checkoutState.checkout.confirm({ redirect: 'if_required' });
      if (result.type === 'error') setError(result.error.message || 'Payment could not be completed. Please check your card details.');
      else onComplete();
    } catch {
      setError('Payment could not be completed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return <form onSubmit={event => void submit(event)} className="space-y-6">
    <div className="rounded-xl border border-primary/50 bg-primary/10 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Your order</p>
      <h4 className="mt-2 break-all text-lg font-semibold">{domain}</h4>
      <p className="mt-1 text-sm text-muted-foreground">Domain registration · 1 year</p>
      <div className="mt-4 flex items-center justify-between border-t border-primary/30 pt-4 text-lg font-semibold"><span>Total today</span><span>{total}</span></div>
      <p className="mt-1 text-xs text-muted-foreground">Automatic renewal is off.</p>
    </div>
    <div>
      <h4 className="mb-4 text-lg font-semibold">Card details</h4>
      {checkoutState.type === 'error' ? <p role="alert" className="text-sm text-destructive">{checkoutState.error.message}</p> :
        <PaymentElement options={{ wallets: { link: 'never', applePay: 'never', googlePay: 'never' } }} />}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={checkoutState.type !== 'success' || submitting}>
      {submitting ? 'Processing payment…' : `Pay ${total} and register domain`}
    </Button>
    <button type="button" onClick={onBack} disabled={submitting} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">Back to domain search</button>
  </form>;
}

export function DomainPaymentForm({ clientSecret, domain, price, currency, onComplete, onBack }: Props) {
  const stripeInstance = stripe();
  if (!stripeInstance) return <p role="alert">Secure payment is unavailable right now.</p>;
  return <section className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6" aria-label="Domain checkout">
    <h3 className="mb-2 font-serif text-2xl">Complete your purchase</h3>
    <p className="mb-6 text-sm text-muted-foreground">Enter your card below. Your payment details are processed securely.</p>
    <CheckoutElementsProvider stripe={stripeInstance} options={{
      clientSecret,
      elementsOptions: { appearance: { theme: 'night', variables: { colorPrimary: '#facc15', colorBackground: '#10151d', colorText: '#f8f6ef', borderRadius: '8px' } } },
    }}>
      <PaymentFields domain={domain} price={price} currency={currency} onComplete={onComplete} onBack={onBack} />
    </CheckoutElementsProvider>
  </section>;
}
