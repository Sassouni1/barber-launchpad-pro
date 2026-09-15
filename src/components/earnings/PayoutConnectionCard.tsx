import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type PayoutAccount = {
  connected: boolean;
  eligible: boolean;
  reason?: string | null;
  payoutsEnabled?: boolean;
  bank?: { last4: string; name: string | null } | null;
  needsInfo?: boolean;
  pendingVerification?: boolean;
};

export type PayoutData = {
  account: PayoutAccount;
  transfers: Array<{
    id: string;
    amount_cents: number;
    status: string;
    failure_message: string | null;
    sent_at: string | null;
    created_at: string;
  }>;
  autoPayoutsReady: boolean;
  releaseTiming?: 'on_verified' | 'after_days' | null;
  releaseDelayDays?: number | null;
};

const TRANSFER_LABEL: Record<string, string> = {
  queued: 'Waiting to send',
  processing: 'Sending',
  sent: 'Sent to your Stripe balance',
  paid: 'Sent to your Stripe balance',
  blocked: 'On hold',
  failed: 'Did not go through',
  canceled: 'Canceled',
};

const money = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/**
 * Shared payout connection for every kind of bonus earning — referrals and
 * content rewards both pay out through this one Stripe connection.
 */
export function PayoutConnectionCard({ compact = false, onboardingCtaOnly = false, onPayoutsReady, joining = false }: { compact?: boolean; onboardingCtaOnly?: boolean; onPayoutsReady?: () => void; joining?: boolean }) {
  const [payouts, setPayouts] = useState<PayoutData | null>(null);
  const [checking, setChecking] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setChecking(true);
    setFailed(false);
    const { data: res, error } = await supabase.functions.invoke('affiliate-payouts', { body: { action: 'status' } });
    if (error || !res) {
      setFailed(true);
    } else {
      setPayouts(res as PayoutData);
    }
    setChecking(false);
  };

  useEffect(() => {
    void load();
    if (new URLSearchParams(window.location.search).has('payouts')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (!checking && !failed && compact && payouts?.account?.eligible) {
    const bank = payouts.account.bank
      ? `${payouts.account.bank.name ?? 'Bank account'} ••••${payouts.account.bank.last4}`
      : 'Connected bank';
    const timing = payouts.releaseTiming === 'after_days'
      ? `Paid automatically after ${payouts.releaseDelayDays ?? 7} days`
      : 'Automatic payouts';
    return (
      <div className="flex flex-col gap-1 border-t border-border pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
        <span className="font-medium text-foreground"><span className="mr-2 text-primary">●</span>Payouts ready</span>
        <span className="hidden sm:inline text-border">|</span>
        <span>{bank}</span>
        <span className="hidden sm:inline text-border">|</span>
        <span>{timing}</span>
      </div>
    );
  }

  const startSetup = async () => {
    setBusy(true);
    const { data: res, error } = await supabase.functions.invoke('affiliate-payouts', {
      body: { action: 'start_onboarding', returnPath: window.location.pathname },
    });
    setBusy(false);
    const url = (res as { url?: string } | null)?.url;
    if (error || !url) {
      toast({ title: 'Could not open payout setup', description: 'Please try again in a moment.', variant: 'destructive' });
      return;
    }
    window.location.href = url;
  };

  if (!checking && !failed && onboardingCtaOnly) {
    if (payouts?.account?.eligible) {
      return onPayoutsReady ? (
        <Button onClick={onPayoutsReady} disabled={joining} size="lg">
          {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Get my referral links
        </Button>
      ) : null;
    }
    return (
      <Button onClick={startSetup} disabled={busy} size="lg">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {payouts?.account?.connected ? 'Finish payout setup with Stripe' : 'Set up payouts with Stripe'}
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {checking && <div className="text-sm text-muted-foreground">Checking your payout setup…</div>}

        {!checking && failed && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertDescription>We couldn’t check your payout setup just now.</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => void load()}>Try again</Button>
          </div>
        )}

        {payouts?.account?.eligible && (
          <div className="flex items-start gap-3 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="font-semibold">Payouts ready</div>
              <div className="mt-0.5 text-muted-foreground">
                {payouts.account.bank
                  ? `${payouts.account.bank.name ?? 'Bank account'} ••••${payouts.account.bank.last4}`
                  : 'Your connected bank is ready to receive payouts.'}
              </div>
              {payouts.autoPayoutsReady && (
                <div className="mt-1 text-muted-foreground">
                  Automatic payouts{payouts.releaseTiming === 'after_days' ? ` after ${payouts.releaseDelayDays ?? 7} days.` : '.'}
                </div>
              )}
            </div>
          </div>
        )}

        {payouts && payouts.account?.connected && !payouts.account.eligible && (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                {payouts.account.pendingVerification
                  ? 'Stripe is still reviewing your details. We’ll start sending money as soon as it clears — Stripe doesn’t give a guaranteed time.'
                  : payouts.account.reason ?? 'Your Stripe account can’t receive payouts yet.'}
              </AlertDescription>
            </Alert>
            {payouts.account.needsInfo && (
              <Button onClick={startSetup} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Finish payout setup with Stripe
              </Button>
            )}
          </div>
        )}

        {payouts && !payouts.account?.connected && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add the bank account you want your money sent to. It’s a short form — Stripe collects your bank and ID
              details on its own secure page, and we never see them. Stripe may ask for more before it approves you.
            </p>
            <Button onClick={startSetup} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Set up my payouts
            </Button>
          </div>
        )}

        {payouts && !payouts.autoPayoutsReady && (
          <Alert>
            <AlertDescription>
              Automatic payments are not active yet — setup isn’t finished, so no money is being sent. Everything you
              earn is recorded here and will be sent once the Barber Launch team turns payouts on.
            </AlertDescription>
          </Alert>
        )}

        {payouts?.autoPayoutsReady && !payouts.account?.eligible && (
          <Alert>
            <AlertDescription>
              Payments are automatic. Each amount is sent{' '}
              {payouts.releaseTiming === 'after_days'
                ? `${payouts.releaseDelayDays ?? 7} days after the customer's payment clears`
                : 'once the customer payment is confirmed'}
              , as long as it hasn’t been refunded or disputed and your account is ready. After it leaves here, Stripe
              moves it to your bank on your own payout schedule, so the money usually lands a couple of business days
              later.
            </AlertDescription>
          </Alert>
        )}

        {(payouts?.transfers ?? []).length > 0 && (
          <div className="pt-1">
            {payouts!.transfers.map((tr) => (
              <div key={tr.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                <div className="min-w-0">
                  <div>{TRANSFER_LABEL[tr.status] ?? tr.status}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(tr.sent_at ?? tr.created_at).toLocaleDateString()}
                    {tr.failure_message ? ` — ${tr.failure_message}` : ''}
                  </div>
                </div>
                <span className="font-medium shrink-0">{money(tr.amount_cents)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
