import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  ExternalLink,
  Loader2,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Bot,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const FN_NAME = 'barber-launch-stripe';

interface AccountRow {
  id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
}

/**
 * Compact Stripe sign-up card for the Consumer Financing lesson.
 * Sign-up only — full management stays on the My Links page.
 */
export function StripeSignupCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [account, setAccount] = useState<AccountRow | null>(null);

  const invoke = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke(FN_NAME, {
      body: { action, ...payload },
    });
    if (error) {
      const status = (error as any)?.context?.status;
      const message = (error as any)?.message || 'Edge function error';
      if (status === 404 || /Failed to send a request/i.test(message)) {
        setUnavailable(true);
        throw new Error('BACKEND_UNAVAILABLE');
      }
      throw new Error(message);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await invoke('getStatus');
      setAccount(data.account ?? null);
      setUnavailable(false);

      // Make sure their preset links exist as soon as the account is live,
      // so My Links is populated the moment they get there.
      if (data?.account?.charges_enabled && (data.links ?? []).length === 0) {
        try {
          await invoke('syncPaymentLinks');
        } catch (_) {
          /* silent */
        }
      }
    } catch (e: any) {
      if (e?.message !== 'BACKEND_UNAVAILABLE') {
        toast.error(e?.message || 'Could not load your Stripe status');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onStartOnboarding = async () => {
    setBusy('onboard');
    try {
      const data = await invoke('startOnboarding');
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      if (e?.message !== 'BACKEND_UNAVAILABLE') {
        toast.error(e?.message || 'Could not start Stripe onboarding');
      }
    } finally {
      setBusy(null);
    }
  };

  const ready = !!account?.charges_enabled;

  if (unavailable) return null;

  return (
    <Card className="glass-card animate-fade-up">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Set Up Consumer Financing Payments
          </span>
          {account ? (
            ready ? (
              <Badge className="bg-green-500/15 text-green-500 border border-green-500/30">
                Active
              </Badge>
            ) : (
              <Badge className="bg-yellow-500/15 text-yellow-500 border border-yellow-500/30">
                Onboarding incomplete
              </Badge>
            )
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : ready ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                <span className="relative flex items-center justify-center rounded-full bg-primary/15 border border-primary/40 p-2.5">
                  <Bot className="w-6 h-6 text-primary" />
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold leading-tight">
                  Your links live here now
                </h3>
                <p className="text-sm text-muted-foreground">
                  Going forward, this is where your payment links live.
                </p>
              </div>
            </div>

            <Link
              to="/my-links"
              className="group relative block overflow-hidden rounded-xl border-2 border-primary/50 bg-primary/10 p-6 text-center shadow-[0_0_32px_hsl(var(--primary)/0.35)] transition-all duration-300 hover:shadow-[0_0_56px_hsl(var(--primary)/0.55)] hover:border-primary/70 animate-[pulse_2.5s_cubic-bezier(0.4,0,0.6,1)_infinite]"
            >
              <div className="absolute -right-3 -top-3 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <ArrowRight className="w-24 h-24 text-primary rotate-12" />
              </div>
              <p className="relative text-lg md:text-xl font-bold text-primary">
                “Hey, dude — going forward, here’s where your links will be.”
              </p>
              <span className="relative mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Go to My Links
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
              </span>
            </Link>

            <p className="text-sm text-muted-foreground text-center">
              Look for <strong className="text-primary">My Links</strong> in the sidebar whenever you need it.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {account
                ? "You started onboarding but Stripe hasn't fully verified your account yet. Continue to finish — your payment links appear in My Links as soon as you're approved."
                : 'Create your own Stripe account to start accepting card and Klarna payments. Funds go directly to your bank, and your payment links show up automatically inside My Links.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={onStartOnboarding}
                disabled={busy === 'onboard'}
                className="gold-gradient text-black font-semibold"
              >
                {busy === 'onboard' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : account ? (
                  <ExternalLink className="w-4 h-4 mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {account ? 'Continue Stripe Onboarding' : 'Create Stripe Account'}
              </Button>
              <Button variant="outline" onClick={refresh} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
