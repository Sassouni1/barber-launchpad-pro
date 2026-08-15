import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, CreditCard, Facebook, Loader2, Megaphone, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { FacebookConnectButton } from '@/components/ads/FacebookConnectButton';
import { InstagramStatusCard } from '@/components/ads/InstagramStatusCard';
import { useAdSocialConnection } from '@/hooks/useAdSocialConnection';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => {
  if (!STRIPE_PUBLISHABLE_KEY) return null;
  if (!stripePromise) stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  return stripePromise;
};


type Campaign = {
  id: string;
  name: string;
  status: string;
  desired_status: string;
  daily_budget_cents: number;
  funded_cents: number;
  spent_cents: number;
};

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

function StepHeader({ index, title, done }: { index: number; title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
          done ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : index}
      </span>
      <p className="font-medium">
        <span className="text-xs tracking-[.18em] text-muted-foreground mr-2">STEP {index}</span>
        {title}
      </p>
    </div>
  );
}

export default function Ads() {
  const queryClient = useQueryClient();
  const { data: connection, isLoading: connectionLoading } = useAdSocialConnection();
  const connected = connection?.connection_status === 'connected';

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['member-ad-campaigns'],
    enabled: connected,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('managed-ad-campaigns', {
        body: { action: 'getDashboard' },
      });
      if (error) throw error;
      return (data?.campaigns ?? []) as Campaign[];
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('funding_session_id')) return;
    toast.success('Payment submitted. Your media balance updates as soon as Stripe confirms it.');
    queryClient.invalidateQueries({ queryKey: ['member-ad-campaigns'] });
    params.delete('funding_session_id');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [queryClient]);

  const intro = (
    <p className="text-muted-foreground text-sm mt-1">
      Barber Launch sets up and runs your campaigns from our managed Meta account.
    </p>
  );

  // ---- Onboarding: Facebook not connected yet ----
  if (!connected) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <span className="text-xs tracking-[.18em] text-primary font-semibold">BARBER LAUNCH ADS</span>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-2">Set up your advertising</h1>
            {intro}
          </div>

          <div className="glass-card rounded-xl p-5 space-y-4">
            <StepHeader index={1} title="Connect Facebook" />
            <p className="text-sm text-muted-foreground">
              Connect the Facebook Page your ads will run from. We never see your password.
            </p>
            {connectionLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking your connection…
              </div>
            ) : (
              <FacebookConnectButton />
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ---- Connected: staged setup ----
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <span className="text-xs tracking-[.18em] text-primary font-semibold">BARBER LAUNCH ADS</span>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-2">Set up your advertising</h1>
          {intro}
        </div>

        <div className="glass-card rounded-xl p-5 space-y-3">
          <StepHeader index={1} title="Connect Facebook" done />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Facebook className="w-4 h-4 text-primary" />
              <span className="text-primary font-medium">Facebook connected</span>
              {connection?.facebook_page_name && (
                <span className="text-muted-foreground truncate">
                  · Page: <span className="text-foreground">{connection.facebook_page_name}</span>
                </span>
              )}
            </div>
            <FacebookConnectButton />
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-4">
          <StepHeader index={2} title="Ad Billing" />
          <p className="text-sm text-muted-foreground">
            Add prepaid media funds so your campaigns can run. Payment is handled securely by Stripe right here on this
            page. Minimum $2.00.
          </p>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading campaigns…</div>
          ) : campaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Barber Launch will add your campaign here — billing opens up as soon as it's live.
            </div>
          ) : (
            campaigns.map((c) => (
              <AdBillingPanel
                key={c.id}
                campaign={c}
                onChanged={() => queryClient.invalidateQueries({ queryKey: ['member-ad-campaigns'] })}
              />
            ))
          )}
        </div>

        <div className="glass-card rounded-xl p-5 space-y-4">
          <StepHeader index={3} title="Instagram (optional)" />
          <InstagramStatusCard />
        </div>

        {campaigns.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs tracking-[.18em] text-muted-foreground font-semibold">YOUR CAMPAIGNS</p>
            {campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onChanged={() => queryClient.invalidateQueries({ queryKey: ['member-ad-campaigns'] })}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function AdBillingPanel({ campaign, onChanged }: { campaign: Campaign; onChanged: () => void }) {
  const [fundingAmount, setFundingAmount] = useState('2.00');
  const [fundingBusy, setFundingBusy] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [pendingCents, setPendingCents] = useState<number | null>(null);
  const balance = campaign.funded_cents - campaign.spent_cents;

  const startPayment = async () => {
    const dollars = Number(fundingAmount);
    const amountCents = Math.round(dollars * 100);
    if (!Number.isFinite(dollars) || amountCents < 200) {
      return toast.error('Enter a funding amount of at least $2.00.');
    }
    if (!getStripe()) {
      setFundingError('Card payments are not configured yet. Please contact Barber Launch support.');
      return;
    }
    setFundingBusy(true);
    setFundingError(null);
    try {
      const { data, error } = await supabase.functions.invoke('managed-ad-billing', {
        body: {
          action: 'createCheckout',
          campaignId: campaign.id,
          amountCents,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      if (error) throw error;
      const secret = (data as { clientSecret?: string | null } | null)?.clientSecret;
      if (typeof secret === 'string' && secret) {
        setPendingCents(amountCents);
        setClientSecret(secret);
        return;
      }
      const message = (data as { error?: string } | null)?.error;
      setFundingError(message || 'Could not start the secure payment form. Please try again.');
    } catch (err) {
      setFundingError(err instanceof Error ? err.message : 'Could not start the secure payment form. Please try again.');
    } finally {
      setFundingBusy(false);
    }
  };

  const cancelPayment = () => {
    setClientSecret(null);
    setPendingCents(null);
    setFundingError(null);
  };

  const onCheckoutComplete = useCallback(() => {
    setClientSecret(null);
    setPendingCents(null);
    toast.success('Payment submitted. Your media balance updates as soon as Stripe confirms it.');
    onChanged();
  }, [onChanged]);

  const checkoutOptions = useMemo(
    () => (clientSecret ? { clientSecret, onComplete: onCheckoutComplete } : null),
    [clientSecret, onCheckoutComplete],
  );

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">{campaign.name}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <WalletCards className="w-4 h-4 text-primary" />
          <span>{money(balance)} media balance</span>
        </div>
      </div>

      {!clientSecret ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs">Amount (USD)</Label>
            <Input
              type="number"
              min="2"
              step="0.01"
              inputMode="decimal"
              value={fundingAmount}
              onChange={(e) => setFundingAmount(e.target.value)}
              disabled={fundingBusy}
              className="mt-1"
            />
          </div>
          <Button size="sm" onClick={startPayment} disabled={fundingBusy}>
            {fundingBusy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Preparing…
              </>
            ) : (
              'Continue to secure payment'
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Funding <span className="text-foreground font-medium">{money(pendingCents ?? 0)}</span> to {campaign.name}
            </p>
            <Button size="sm" variant="ghost" onClick={cancelPayment}>
              Cancel payment
            </Button>
          </div>
          <div className="rounded-lg bg-white p-2 overflow-hidden">
            {checkoutOptions && (
              <EmbeddedCheckoutProvider stripe={getStripe()!} options={checkoutOptions}>
                <EmbeddedCheckout className="min-h-[420px]" />
              </EmbeddedCheckoutProvider>
            )}
          </div>
        </div>
      )}

      {fundingError && (
        <p className="text-xs text-destructive" role="alert">
          {fundingError}
        </p>
      )}
    </div>
  );
}

function CampaignCard({ campaign, onChanged }: { campaign: Campaign; onChanged: () => void }) {
  const [budget, setBudget] = useState((campaign.daily_budget_cents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const balance = campaign.funded_cents - campaign.spent_cents;
  const on = campaign.desired_status === 'active';

  useEffect(() => {
    setBudget((campaign.daily_budget_cents / 100).toFixed(2));
  }, [campaign.daily_budget_cents]);

  const toggle = async (next: boolean) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('managed-ad-campaigns', {
      body: { action: 'setDesiredStatus', campaign_id: campaign.id, desired_status: next ? 'active' : 'paused' },
    });
    setBusy(false);
    const message = (data as { error?: string } | null)?.error;
    if (error || message) {
      return toast.error(message || 'This campaign has no media balance, so it cannot be turned on.');
    }
    toast.success(next ? 'Campaign set to on.' : 'Campaign set to off.');
    onChanged();
  };

  const saveBudget = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('managed-ad-campaigns', {
      body: { action: 'setBudget', campaign_id: campaign.id, daily_budget_cents: Math.round(Number(budget || 0) * 100) },
    });
    setBusy(false);
    const message = (data as { error?: string } | null)?.error;
    if (error || message) return toast.error(message || 'Could not update the daily budget.');
    toast.success('Daily budget updated.');
    onChanged();
  };

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            <p className="font-medium">{campaign.name}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{money(campaign.daily_budget_cents)}/day</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={on ? 'default' : 'secondary'}>{on ? 'On' : 'Off'}</Badge>
          <Switch checked={on} disabled={busy} onCheckedChange={toggle} aria-label="Campaign on or off" />
        </div>
      </div>

      <div className="border-t border-border/60 pt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs">Daily budget (USD)</Label>
          <Input
            type="number"
            min="10"
            step="1"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button size="sm" variant="outline" onClick={saveBudget} disabled={busy}>
          Save budget
        </Button>
      </div>

      <div className="border-t border-border/60 pt-4 flex items-center gap-2 text-sm">
        <WalletCards className="w-4 h-4 text-primary" />
        <span>{money(balance)} media balance</span>
      </div>
    </div>
  );
}
