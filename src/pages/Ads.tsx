import { useCallback, useEffect, useState } from 'react';
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
import { FacebookConnectButton } from '@/components/ads/FacebookConnectButton';
import { adSocialErrorMessage } from '@/lib/adSocialError';
import { InstagramStatusCard } from '@/components/ads/InstagramStatusCard';
import { CampaignResults } from '@/components/ads/CampaignResults';

import { useAdSocialConnection } from '@/hooks/useAdSocialConnection';
import { useAdBillingProfile } from '@/hooks/useAdBillingProfile';
import { useAuth } from '@/hooks/useAuth';




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
  const { user } = useAuth();
  const { data: connection, isLoading: connectionLoading } = useAdSocialConnection();
  const { data: billingProfile } = useAdBillingProfile();
  const connected = connection?.connection_status === 'connected';
  const instagramConnected = !!connection?.instagram_business_account_id;
  const instagramSkipped = !!connection?.instagram_skipped_at;
  const instagramDecided = instagramConnected || instagramSkipped;
  // Durable completion signal: a saved default payment method (not a $0 balance
  // and not an in-progress checkout attempt).
  const billingComplete = !!billingProfile?.default_payment_method_id;
  const onboardingComplete = connected && instagramDecided && billingComplete;
  const [skipping, setSkipping] = useState(false);

  const { data: campaigns = [], isLoading, isError: campaignsError } = useQuery({
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

  const [fundingReturnSession, setFundingReturnSession] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returned = params.get('funding_session_id');
    const canceled = params.get('funding_canceled');
    if (!returned && !canceled) return;
    if (returned) setFundingReturnSession(returned);
    else toast.message('Payment canceled. No charge was made.');
    params.delete('funding_session_id');
    params.delete('funding_canceled');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['member-ad-campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['ad-billing-profile', user?.id] });
  };

  const skipInstagram = async () => {
    setSkipping(true);
    const { data, error } = await supabase.functions.invoke('managed-ad-social', {
      body: { action: 'skipInstagram' },
    });
    setSkipping(false);
    if (error || data?.error) {
      return toast.error(await adSocialErrorMessage(data, error, 'Could not save that choice.'));
    }
    await queryClient.invalidateQueries({ queryKey: ['ad-social-connection', user?.id] });
    toast.success('Skipped Instagram for now. You can connect it later.');
  };

  const intro = (
    <>
      <p className="text-muted-foreground text-sm mt-1">
        Barber Launch sets up and runs your campaigns from our managed Meta account.
      </p>
      {fundingReturnSession && (
        <FundingReturnStatus
          sessionId={fundingReturnSession}
          onConfirmed={() => {
            queryClient.invalidateQueries({ queryKey: ['member-ad-campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['ad-billing-profile', user?.id] });
          }}
          onDismiss={() => setFundingReturnSession(null)}
        />
      )}
    </>
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

  // ---- Campaign management (onboarding finished) ----
  if (onboardingComplete) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <span className="text-xs tracking-[.18em] text-primary font-semibold">BARBER LAUNCH ADS</span>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-2">Your campaigns</h1>
            {intro}
          </div>

          <CardSetupPanel />

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading campaigns…</div>
          ) : campaignsError ? (
            <CampaignsError onRetry={refreshAll} />
          ) : campaigns.length === 0 ? (
            <div className="glass-card rounded-xl p-5 text-sm text-muted-foreground">
              Your card is saved. Barber Launch will add your campaign here once it's created, and you can add media
              funds to it then.
            </div>
          ) : (
            campaigns.map((c) => <CampaignCard key={c.id} campaign={c} onChanged={refreshAll} />)
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ---- Onboarding: Facebook connected, remaining steps ----
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
            <FacebookConnectButton showPageName={false} connectedLabel="Switch Facebook" />
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-4">
          <StepHeader index={2} title="Connect your Instagram (optional)" done={instagramDecided} />
          {instagramConnected ? (
            <InstagramStatusCard />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Linking a professional Instagram account to your Facebook Page lets your ads run on Instagram too. This
                is optional and doesn't block billing.
              </p>
              <InstagramStatusCard />
              {instagramSkipped ? (
                <p className="text-xs text-muted-foreground border-t border-border/60 pt-4">
                  Skipped for now. You can connect Instagram any time.
                </p>
              ) : (
                <div className="border-t border-border/60 pt-4 space-y-2">
                  <Button variant="outline" size="sm" onClick={skipInstagram} disabled={skipping}>
                    {skipping ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Skip Instagram for now
                  </Button>
                  <p className="text-xs text-muted-foreground">I do not have an Instagram to connect right now.</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="glass-card rounded-xl p-5 space-y-4">
          <StepHeader index={3} title="Ad Billing" done={billingComplete} />
          <CardSetupPanel embedded />
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading campaigns…</div>
          ) : campaignsError ? (
            <CampaignsError onRetry={refreshAll} />
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Adding media funds opens once Barber Launch has created your campaign. Prepaid funding is a separate step,
              minimum $2.00.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add prepaid media funds to a campaign. Payment is handled securely by Stripe right here. Minimum $2.00.
              </p>
              {campaigns.map((c) => (
                <AdBillingPanel key={c.id} campaign={c} onChanged={refreshAll} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function CampaignsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-sm text-destructive flex flex-wrap items-center gap-3" role="alert">
      Could not load your campaigns. Check your connection and try again.
      <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  );
}

async function readErrorMessage(data: unknown, error: unknown, fallback: string) {
  const fromData = (data as { error?: string } | null)?.error;
  if (fromData) return fromData;
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.clone().json();
      if (body?.error) return String(body.error);
    } catch { /* ignore */ }
  }
  return fallback;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SETUP_PREVIOUS_KEY = 'ad-card-setup-previous';

/** Saves a card with Stripe-hosted Checkout in setup mode. No charge; success is shown only after the server has it. */
function CardSetupPanel({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: billingProfile, isLoading, isError, refetch } = useAdBillingProfile();
  const saved = billingProfile?.default_payment_method_id ?? null;
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waitForServer = useCallback(async (previous: string | null) => {
    setWaiting(true);
    setError(null);
    for (let i = 0; i < 30; i += 1) {
      const { data } = await refetch();
      const current = data?.default_payment_method_id ?? null;
      if (current && current !== previous) {
        setWaiting(false);
        toast.success('Card saved. No charge was made and no media funds were added.');
        queryClient.invalidateQueries({ queryKey: ['ad-billing-profile', user?.id] });
        return;
      }
      await sleep(2000);
    }
    setWaiting(false);
    setError("Stripe hasn't confirmed your card yet. Refresh this page in a minute; if it still isn't saved, contact Barber Launch support.");
  }, [refetch, queryClient, user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returned = params.get('setup_session_id');
    const canceled = params.get('setup_canceled');
    if (!returned && !canceled) return;
    params.delete('setup_session_id');
    params.delete('setup_canceled');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    const previous = sessionStorage.getItem(SETUP_PREVIOUS_KEY);
    sessionStorage.removeItem(SETUP_PREVIOUS_KEY);
    if (returned) void waitForServer(previous && previous !== 'none' ? previous : null);
  }, [waitForServer]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('managed-ad-billing', {
        body: { action: 'createSetupCheckout', idempotencyKey: crypto.randomUUID() },
      });
      const url = (data as { url?: string | null } | null)?.url;
      if (!invokeError && typeof url === 'string' && url.startsWith('https://checkout.stripe.com/')) {
        sessionStorage.setItem(SETUP_PREVIOUS_KEY, saved ?? 'none');
        window.location.assign(url);
        return;
      }
      setError(await readErrorMessage(data, invokeError, 'Could not open the secure Stripe page. Please try again.'));
      setBusy(false);
    } catch {
      setError('Could not reach billing. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <div className={`${embedded ? '' : 'glass-card '}rounded-lg border border-border/60 bg-background/40 p-4 space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <CreditCard className="w-4 h-4 text-primary" />
          {isLoading ? (
            <span className="text-muted-foreground">Checking your saved card…</span>
          ) : saved ? (
            <span className="text-primary font-medium">Card saved</span>
          ) : (
            <span className="font-medium">Payment method</span>
          )}
        </div>
        {!waiting && (
          <Button size="sm" variant={saved ? 'outline' : 'default'} onClick={start} disabled={busy || isLoading}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {busy ? 'Opening secure Stripe page…' : saved ? 'Replace card' : 'Add payment method'}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        You'll be redirected to a secure Stripe page to save your card, then brought back here. Saving a card does not charge you, does not add media funds, and does not start any ads.
      </p>
      {isError && <p className="text-xs text-destructive" role="alert">Could not check your saved card. Refresh to try again.</p>}
      {waiting && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Waiting for Stripe to confirm your card…
        </div>
      )}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}

type FundingStatusResponse = {
  state?: 'not_found' | 'pending' | 'failed' | 'confirmed';
  amountCents?: number;
  balanceCents?: number;
  campaignName?: string | null;
  error?: string;
};

/** After Stripe redirects back, success is shown only once the server confirms the webhook-recorded ledger entry. */
function FundingReturnStatus({ sessionId, onConfirmed, onDismiss }: { sessionId: string; onConfirmed: () => void; onDismiss: () => void }) {
  const [status, setStatus] = useState<FundingStatusResponse | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (let i = 0; i < 30 && !cancelled; i += 1) {
        const { data, error } = await supabase.functions.invoke('managed-ad-billing', {
          body: { action: 'getFundingStatus', sessionId },
        });
        if (cancelled) return;
        if (error || (data as FundingStatusResponse | null)?.error) {
          setRequestError(await readErrorMessage(data, error, 'Could not check this payment. Refresh before paying again.'));
          return;
        }
        const next = data as FundingStatusResponse;
        setStatus(next);
        if (next.state === 'confirmed') {
          onConfirmed();
          return;
        }
        if (next.state === 'failed' || next.state === 'not_found') return;
        await sleep(2000);
      }
      if (!cancelled) setTimedOut(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const state = status?.state;
  return (
    <div className="glass-card mt-4 rounded-lg border border-border/60 bg-background/40 p-4 text-sm space-y-2" role="status">
      {requestError ? (
        <p className="text-destructive">{requestError}</p>
      ) : state === 'confirmed' ? (
        <p className="text-primary font-medium">
          Payment confirmed: {money(status?.amountCents ?? 0)} added to {status?.campaignName ?? 'your campaign'}. New media balance: {money(status?.balanceCents ?? 0)}.
        </p>
      ) : state === 'failed' ? (
        <p className="text-destructive">This payment did not go through. No media funds were added.</p>
      ) : state === 'not_found' ? (
        <p className="text-destructive">We couldn't find this payment on your account. Refresh before paying again, or contact Barber Launch support.</p>
      ) : timedOut ? (
        <p className="text-destructive">
          Stripe hasn't confirmed {status?.amountCents ? money(status.amountCents) : 'this payment'} yet. Refresh in a minute before paying again; contact support if your balance doesn't update.
        </p>
      ) : (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Waiting for Stripe to confirm your payment
          {status?.amountCents ? ` of ${money(status.amountCents)}` : ''}… Your balance updates only after confirmation.
        </p>
      )}
      {(state === 'confirmed' || state === 'failed' || state === 'not_found' || timedOut || requestError) && (
        <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
      )}
    </div>
  );
}

function AdBillingPanel({ campaign }: { campaign: Campaign; onChanged?: () => void }) {
  const [fundingAmount, setFundingAmount] = useState('2.00');
  const [fundingBusy, setFundingBusy] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const balance = campaign.funded_cents - campaign.spent_cents;
  const dollars = Number(fundingAmount);
  const amountCents = Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;

  const startPayment = async () => {
    if (amountCents < 200) {
      return toast.error('Enter a funding amount of at least $2.00.');
    }
    setFundingBusy(true);
    setFundingError(null);
    try {
      const { data, error } = await supabase.functions.invoke('managed-ad-billing', {
        body: { action: 'createCheckout', campaignId: campaign.id, amountCents, idempotencyKey: crypto.randomUUID() },
      });
      const url = (data as { url?: string | null } | null)?.url;
      if (!error && typeof url === 'string' && url.startsWith('https://checkout.stripe.com/')) {
        window.location.assign(url);
        return;
      }
      setFundingError(await readErrorMessage(data, error, 'Could not open the secure Stripe page. Please try again.'));
      setFundingBusy(false);
    } catch (err) {
      setFundingError(err instanceof Error ? err.message : 'Could not open the secure Stripe page. Please try again.');
      setFundingBusy(false);
    }
  };

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
              Opening secure Stripe page…
            </>
          ) : (
            'Continue to secure payment'
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        You'll fund <span className="text-foreground font-medium">{amountCents >= 200 ? money(amountCents) : 'at least $2.00'}</span> to{' '}
        <span className="text-foreground font-medium">{campaign.name}</span> on a secure Stripe page, then return here. Your balance updates only after Stripe confirms the payment.
      </p>
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

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Add prepaid media funds to this campaign. Minimum $2.00.</p>
        <AdBillingPanel campaign={campaign} onChanged={onChanged} />
      </div>

      <CampaignResults campaignId={campaign.id} />

    </div>
  );
}
