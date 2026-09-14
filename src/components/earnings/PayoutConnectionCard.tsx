import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Banknote, Loader2 } from 'lucide-react';
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
export function PayoutConnectionCard() {
  const [payouts, setPayouts] = useState<PayoutData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: res, error } = await supabase.functions.invoke('affiliate-payouts', { body: { action: 'status' } });
    if (!error) setPayouts(res as PayoutData);
  };

  useEffect(() => {
    void load();
    if (new URLSearchParams(window.location.search).has('payouts')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const startSetup = async () => {
    setBusy(true);
    const { data: res, error } = await supabase.functions.invoke('affiliate-payouts', {
      body: { action: 'start_onboarding' },
    });
    setBusy(false);
    const url = (res as { url?: string } | null)?.url;
    if (error || !url) {
      toast({ title: 'Could not open payout setup', description: 'Please try again in a moment.', variant: 'destructive' });
      return;
    }
    window.location.href = url;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Banknote className="w-4 h-4 text-primary" /> Getting paid
          </CardTitle>
          {payouts?.account?.eligible && <Badge variant="outline">Payouts ready</Badge>}
        </div>
        <CardDescription>
          One connection covers everything you earn here. Money is sent to your Stripe account automatically, then
          reaches your bank on your own Stripe payout schedule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!payouts && <div className="text-sm text-muted-foreground">Checking your payout setup…</div>}

        {payouts?.account?.eligible && (
          <div className="rounded-md border border-border bg-secondary/30 px-3 py-3 text-sm">
            <div className="font-medium">Use my connected bank</div>
            <div className="text-muted-foreground mt-1">
              {payouts.account.bank
                ? `${payouts.account.bank.name ?? 'Bank account'} ending ${payouts.account.bank.last4}`
                : 'Your Stripe account is set up to pay out to your bank.'}
            </div>
            <div className="text-muted-foreground mt-1">Nothing else to do — you’re already set up.</div>
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
              Automatic payments aren’t switched on yet. Everything you earn is still recorded here and will be sent
              once the Barber Launch team turns payouts on.
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
