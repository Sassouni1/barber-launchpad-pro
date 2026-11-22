import { useState, type FormEvent } from 'react';
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from '@stripe/react-stripe-js/checkout';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { ArrowLeft } from 'lucide-react';
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

  return <form onSubmit={event => void submit(event)} className="space-y-5">
    <div className="rounded-xl border border-border bg-background/40 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Your order</p>
      <h4 className="mt-2 break-all text-lg font-semibold">{domain}</h4>
      <p className="mt-1 text-sm text-muted-foreground">Domain registration · 1 year</p>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-lg font-semibold"><span>Total today</span><span className="text-primary">{total}</span></div>
      <p className="mt-1 text-xs text-muted-foreground">Automatic renewal is off.</p>
    </div>
    <Button type="button" variant="outline" onClick={onBack} disabled={submitting} className="h-11 w-full gap-2 rounded-lg border-primary/60 bg-primary/10 px-5 text-sm font-semibold text-primary hover:border-primary hover:bg-primary/20 hover:text-primary focus-visible:ring-primary sm:w-auto">
      <ArrowLeft className="h-4 w-4" />Back to domain search
    </Button>
    <div>
      <h4 className="mb-4 text-lg font-semibold">Card details</h4>
      <div className="overflow-hidden rounded-xl bg-white p-3 sm:p-5">
        {checkoutState.type === 'error' ? <p role="alert" className="text-sm text-destructive">{checkoutState.error.message}</p> :
          <PaymentElement options={{ wallets: { link: 'never', applePay: 'never', googlePay: 'never' } }} />}
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" className="gold-gradient h-12 w-full text-base font-semibold" disabled={checkoutState.type !== 'success' || submitting}>
      {submitting ? 'Processing payment…' : `Pay ${total} and register domain`}
    </Button>
  </form>;
}

export function DomainPaymentForm({ clientSecret, domain, price, currency, onComplete, onBack }: Props) {
  const stripeInstance = stripe();
  if (!stripeInstance) return <p role="alert">Secure payment is unavailable right now.</p>;
  return <section className="glass-card mt-6 rounded-xl p-5 sm:p-7" aria-label="Domain checkout">
    <h3 className="mb-2 text-xl font-bold">Secure payment</h3>
    <p className="mb-6 text-sm text-muted-foreground">Enter your card below. Your payment details are processed securely.</p>
    <CheckoutElementsProvider stripe={stripeInstance} options={{
      clientSecret,
      elementsOptions: { appearance: { theme: 'stripe', variables: { colorPrimary: '#b88717', colorBackground: '#ffffff', colorText: '#171717', colorDanger: '#dc2626', borderRadius: '8px' } } },
    }}>
      <PaymentFields domain={domain} price={price} currency={currency} onComplete={onComplete} onBack={onBack} />
    </CheckoutElementsProvider>
  </section>;
}
