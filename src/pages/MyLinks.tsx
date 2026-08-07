import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CreditCard,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Plus,
  DollarSign,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface AccountRow {
  id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
}

interface LinkRow {
  id: string;
  template_key: string;
  display_name: string;
  amount_cents: number;
  currency: string;
  url: string | null;
  stripe_payment_link_id: string | null;
  payment_method_types?: string[] | null;
}

interface Earnings {
  currency: string;
  available: number;
  pending: number;
  today: number;
  todayCount: number;
  last7: number;
  last30: number;
  last30Count: number;
  recent: Array<{
    id: string;
    amount: number;
    currency: string;
    created: number;
    description: string | null;
    customerName: string | null;
    customerEmail: string | null;
  }>;
}

const FN_NAME = 'barber-launch-stripe';

function formatMoney(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatMoneyExact(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}



export default function MyLinks() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customKlarna, setCustomKlarna] = useState(true);
  const [customPhone, setCustomPhone] = useState(true);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);


  const invoke = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke(FN_NAME, {
      body: { action, ...payload },
    });
    if (error) {
      // Distinguish 404 (function not deployed) from runtime errors
      const status = (error as any)?.context?.status;
      const message = (error as any)?.message || 'Edge function error';
      if (status === 404 || /Failed to send a request/i.test(message)) {
        setBackendUnavailable(true);
        throw new Error('BACKEND_UNAVAILABLE');
      }
      // Try to read body error
      const ctxBody = (error as any)?.context?.body;
      if (ctxBody) {
        try {
          const parsed = typeof ctxBody === 'string' ? JSON.parse(ctxBody) : ctxBody;
          if (parsed?.error) throw new Error(parsed.error);
        } catch (_) {/* ignore */}
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await invoke('getStatus');
      setAccount(data.account ?? null);
      setLinks(data.links ?? []);
      setBackendUnavailable(false);

      // Auto-create the preset payment links the first time the account is ready.
      if (data?.account?.charges_enabled && (data.links ?? []).length === 0) {
        try {
          const synced = await invoke('syncPaymentLinks');
          if (synced?.links) setLinks(synced.links);
        } catch (_) {
          /* silent — user can still tap the sync button */
        }
      }
    } catch (e: any) {
      if (e?.message !== 'BACKEND_UNAVAILABLE') {
        toast.error(e?.message || 'Could not load Stripe status');
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
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      if (e?.message !== 'BACKEND_UNAVAILABLE') {
        toast.error(e?.message || 'Could not start Stripe onboarding');
      }
    } finally {
      setBusy(null);
    }
  };

  const onSyncLinks = async () => {
    setBusy('sync');
    try {
      const data = await invoke('syncPaymentLinks');
      setLinks(data.links ?? []);
      toast.success(
        data.created
          ? `Created ${data.created} payment link${data.created === 1 ? '' : 's'}`
          : 'All payment links are up to date'
      );
    } catch (e: any) {
      if (e?.message !== 'BACKEND_UNAVAILABLE') {
        toast.error(e?.message || 'Could not sync payment links');
      }
    } finally {
      setBusy(null);
    }
  };

  const onCreateCustom = async () => {
    const amount = Number(customAmount);
    if (!customName.trim()) {
      toast.error('Give your link a name');
      return;
    }
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error('Enter an amount of at least $1');
      return;
    }
    setBusy('custom');
    try {
      const data = await invoke('createCustomLink', {
        name: customName.trim(),
        amountCents: Math.round(amount * 100),
        allowKlarna: customKlarna,
        collectPhone: customPhone,
      });
      setLinks(data.links ?? []);
      toast.success('Custom payment link created');
      setCustomOpen(false);
      setCustomName('');
      setCustomAmount('');
      setCustomKlarna(true);
      setCustomPhone(true);
    } catch (e: any) {
      if (e?.message !== 'BACKEND_UNAVAILABLE') {
        toast.error(e?.message || 'Could not create link');
      }
    } finally {
      setBusy(null);
    }
  };

  const copy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success('Link copied');
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };

  const ready = account?.charges_enabled;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-primary" /> My Links
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Accept deposits and installs directly through your own Stripe account. Share these links with clients to get paid.
          </p>
        </div>

        {backendUnavailable && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Setup required</AlertTitle>
            <AlertDescription>
              The Stripe backend isn't configured yet. An admin needs to set the
              <code className="mx-1 px-1 py-0.5 rounded bg-muted">STRIPE_SECRET_KEY</code>
              secret and deploy the edge function. Once that's done, refresh this page.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Stripe Connection</span>
                  {account ? (
                    ready ? (
                      <Badge className="bg-green-500/15 text-green-500 border-green-500/30 border">
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 border">
                        Onboarding incomplete
                      </Badge>
                    )
                  ) : (
                    <Badge variant="outline">Not connected</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!account && (
                  <p className="text-sm text-muted-foreground">
                    Create your own Stripe account to start accepting card and Klarna
                    payments. Funds go directly to your bank.
                  </p>
                )}

                {account && !ready && (
                  <p className="text-sm text-muted-foreground">
                    You started onboarding but Stripe hasn't fully verified your account
                    yet. Continue to finish.
                  </p>
                )}

                {account && ready && (
                  <p className="text-sm text-muted-foreground">
                    Your Stripe account is connected and ready to accept payments.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {!account && (
                    <Button
                      onClick={onStartOnboarding}
                      disabled={busy === 'onboard' || backendUnavailable}
                      className="gold-gradient text-black font-semibold"
                    >
                      {busy === 'onboard' ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Create Stripe Account
                    </Button>
                  )}
                  {account && !ready && (
                    <Button
                      onClick={onStartOnboarding}
                      disabled={busy === 'onboard' || backendUnavailable}
                    >
                      {busy === 'onboard' ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="w-4 h-4 mr-2" />
                      )}
                      Continue Stripe Onboarding
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={refresh}
                    disabled={loading || backendUnavailable}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                  </Button>
                  {account && ready && (
                    <Button
                      variant="outline"
                      onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" /> Open Stripe Dashboard
                    </Button>
                  )}

                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span>Payment Links</span>
                  {ready && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCustomOpen(true)}
                        disabled={backendUnavailable}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Custom Link
                      </Button>
                      <Button
                        size="sm"
                        onClick={onSyncLinks}
                        disabled={busy === 'sync' || backendUnavailable}
                      >
                        {busy === 'sync' ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-2" />
                        )}
                        {links.length ? 'Sync Links' : 'Create Links'}
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!ready ? (
                  <p className="text-sm text-muted-foreground">
                    Finish connecting Stripe to generate your payment links.
                  </p>
                ) : links.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Click <span className="font-medium">Create Links</span> to generate
                    your 6 preset payment links.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {links.map((l) => (
                      <div
                        key={l.id}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card/40"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{l.display_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatMoney(l.amount_cents, l.currency)} ·{' '}
                            {(l.payment_method_types?.length
                              ? l.payment_method_types
                              : ['card', 'klarna']
                            ).join(' + ')}
                          </div>
                          {l.url && (
                            <div className="text-xs text-muted-foreground truncate mt-1">
                              {l.url}
                            </div>
                          )}
                        </div>
                        {l.url && (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copy(l.url!, l.id)}
                            >
                              {copiedId === l.id ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(l.url!, '_blank')}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Dialog open={customOpen} onOpenChange={setCustomOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create a custom payment link</DialogTitle>
              <DialogDescription>
                Name it whatever you want and set your own price. It goes straight to
                your Stripe account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-name">Link name</Label>
                <Input
                  id="custom-name"
                  placeholder="e.g. Custom Install — Consultation"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-amount">Price (USD)</Label>
                <Input
                  id="custom-amount"
                  type="number"
                  min={1}
                  step="1"
                  placeholder="450"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="custom-klarna"
                  checked={customKlarna}
                  onCheckedChange={(v) => setCustomKlarna(!!v)}
                />
                <Label htmlFor="custom-klarna" className="font-normal">
                  Allow Klarna (pay over time)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="custom-phone"
                  checked={customPhone}
                  onCheckedChange={(v) => setCustomPhone(!!v)}
                />
                <Label htmlFor="custom-phone" className="font-normal">
                  Collect client phone number
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCustomOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={onCreateCustom}
                disabled={busy === 'custom'}
                className="gold-gradient text-black font-semibold"
              >
                {busy === 'custom' && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Create Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
