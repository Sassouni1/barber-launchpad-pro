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
  Undo2,
  RotateCcw,
  XCircle,
  Users,
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
    amountRefunded?: number;
    refunded?: boolean;
    currency: string;
    created: number;
    description: string | null;
    customerName: string | null;
    customerEmail: string | null;
  }>;
}

type RecentPayment = Earnings['recent'][number];

interface SubscriptionRow {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  canceledAt: number | null;
  amount: number;
  currency: string;
  interval: string | null;
  productName: string | null;
  customerName: string | null;
  customerEmail: string | null;
}

interface CustomerRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created: number;
  totalSpent: number;
  paymentCount: number;
  lastPayment: number | null;
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
  const [refundTarget, setRefundTarget] = useState<RecentPayment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[] | null>(null);
  const [subsLoading, setSubsLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<SubscriptionRow | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const onRefund = async () => {
    if (!refundTarget) return;
    const remaining = refundTarget.amount - (refundTarget.amountRefunded ?? 0);
    const amount = Math.round(Number(refundAmount) * 100);
    if (!Number.isFinite(amount) || amount < 50 || amount > remaining) {
      toast.error('Enter a refund amount up to the payment total');
      return;
    }
    setBusy('refund');
    try {
      await invoke('refundCharge', {
        chargeId: refundTarget.id,
        amountCents: amount,
      });
      toast.success('Refund sent to your client');
      setRefundTarget(null);
      await loadEarnings();
    } catch (e: any) {
      if (e?.message !== 'BACKEND_UNAVAILABLE') {
        toast.error(e?.message || 'Could not process the refund');
      }
    } finally {
      setBusy(null);
    }
  };


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

  const loadEarnings = async () => {
    setEarningsLoading(true);
    try {
      const data = await invoke('getEarnings');
      setEarnings(data as Earnings);
    } catch (_) {
      /* silent — earnings are optional */
    } finally {
      setEarningsLoading(false);
    }
  };

  const loadSubscriptions = async () => {
    setSubsLoading(true);
    try {
      const data = await invoke('listSubscriptions');
      setSubscriptions((data?.subscriptions ?? []) as SubscriptionRow[]);
    } catch (_) {
      /* silent */
    } finally {
      setSubsLoading(false);
    }
  };

  const loadCustomers = async () => {
    setCustomersLoading(true);
    try {
      const data = await invoke('listCustomers');
      setCustomers((data?.customers ?? []) as CustomerRow[]);
    } catch (_) {
      /* silent */
    } finally {
      setCustomersLoading(false);
    }
  };

  const onCancelSubscription = async (immediate: boolean) => {
    if (!cancelTarget) return;
    setBusy('cancel');
    try {
      await invoke('cancelSubscription', {
        subscriptionId: cancelTarget.id,
        immediate,
      });
      toast.success(
        immediate
          ? 'Subscription canceled immediately'
          : 'Subscription will end at the end of the current period'
      );
      setCancelTarget(null);
      await loadSubscriptions();
    } catch (e: any) {
      if (e?.message !== 'BACKEND_UNAVAILABLE') {
        toast.error(e?.message || 'Could not cancel the subscription');
      }
    } finally {
      setBusy(null);
    }
  };

  const onResumeSubscription = async (sub: SubscriptionRow) => {
    setBusy(`resume-${sub.id}`);
    try {
      await invoke('resumeSubscription', { subscriptionId: sub.id });
      toast.success('Subscription resumed');
      await loadSubscriptions();
    } catch (e: any) {
      if (e?.message !== 'BACKEND_UNAVAILABLE') {
        toast.error(e?.message || 'Could not resume the subscription');
      }
    } finally {
      setBusy(null);
    }
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

      if (data?.account?.charges_enabled) {
        loadEarnings();
        loadSubscriptions();
        loadCustomers();
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

            {ready && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-primary" /> Earnings
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadEarnings}
                      disabled={earningsLoading}
                    >
                      {earningsLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {!earnings ? (
                    <p className="text-sm text-muted-foreground">
                      {earningsLoading ? 'Loading your numbers…' : 'No earnings data yet.'}
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          {
                            label: 'Today',
                            value: earnings.today,
                            sub: `${earnings.todayCount} payment${earnings.todayCount === 1 ? '' : 's'}`,
                            highlight: true,
                          },
                          { label: 'Last 7 days', value: earnings.last7, sub: '' },
                          {
                            label: 'Last 30 days',
                            value: earnings.last30,
                            sub: `${earnings.last30Count} payment${earnings.last30Count === 1 ? '' : 's'}`,
                          },
                          {
                            label: 'Available balance',
                            value: earnings.available,
                            sub:
                              earnings.pending > 0
                                ? `${formatMoneyExact(earnings.pending, earnings.currency)} pending`
                                : 'Ready to pay out',
                          },
                        ].map((s) => (
                          <div
                            key={s.label}
                            className={`p-3 rounded-lg border bg-card/40 ${
                              s.highlight ? 'border-primary/40' : 'border-border'
                            }`}
                          >
                            <div className="text-xs text-muted-foreground">{s.label}</div>
                            <div
                              className={`text-xl md:text-2xl font-bold mt-1 ${
                                s.highlight ? 'text-primary' : ''
                              }`}
                            >
                              {formatMoneyExact(s.value, earnings.currency)}
                            </div>
                            {s.sub && (
                              <div className="text-[11px] text-muted-foreground mt-1">
                                {s.sub}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-2">Recent payments</div>
                        {earnings.recent.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No payments yet — share your links to get your first one.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {earnings.recent.map((p) => {
                              const remaining = p.amount - (p.amountRefunded ?? 0);
                              const fullyRefunded = remaining <= 0;
                              return (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card/40"
                                >
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">
                                      {p.customerName || p.customerEmail || 'Client payment'}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {p.description ? `${p.description} · ` : ''}
                                      {new Date(p.created * 1000).toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                      })}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right">
                                      <div
                                        className={`font-semibold ${fullyRefunded ? 'line-through text-muted-foreground' : ''}`}
                                      >
                                        {formatMoneyExact(p.amount, p.currency)}
                                      </div>
                                      {(p.amountRefunded ?? 0) > 0 && (
                                        <div className="text-[11px] text-muted-foreground">
                                          {fullyRefunded
                                            ? 'Refunded'
                                            : `${formatMoneyExact(p.amountRefunded, p.currency)} refunded`}
                                        </div>
                                      )}
                                    </div>
                                    {!fullyRefunded && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setRefundTarget(p);
                                          setRefundAmount((remaining / 100).toFixed(2));
                                        }}
                                      >
                                        <Undo2 className="w-3.5 h-3.5 mr-1" />
                                        Refund
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>


                      <p className="text-xs text-muted-foreground">
                        Totals are gross payments before Stripe fees. Payouts land in your
                        bank on Stripe's schedule.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="links" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="links">Links</TabsTrigger>
                <TabsTrigger value="transactions">Payments</TabsTrigger>
                <TabsTrigger value="customers">Customers</TabsTrigger>
                <TabsTrigger value="subscriptions">Plans</TabsTrigger>
              </TabsList>

              <TabsContent value="subscriptions" className="mt-4">
            {ready && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <RotateCcw className="w-5 h-5 text-primary" /> Subscriptions
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadSubscriptions}
                      disabled={subsLoading}
                    >
                      {subsLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!subscriptions || subscriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {subsLoading
                        ? 'Loading subscriptions…'
                        : 'No recurring plans yet. Any subscription a client starts through your Stripe account shows up here so you can cancel it.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {subscriptions.map((s) => {
                        const active = s.status === 'active' || s.status === 'trialing';
                        return (
                          <div
                            key={s.id}
                            className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card/40"
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {s.customerName || s.customerEmail || 'Client'}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {s.productName ? `${s.productName} · ` : ''}
                                {formatMoneyExact(s.amount, s.currency)}
                                {s.interval ? ` / ${s.interval}` : ''}
                                {s.currentPeriodEnd
                                  ? ` · ${s.cancelAtPeriodEnd ? 'ends' : 'renews'} ${new Date(
                                      s.currentPeriodEnd * 1000
                                    ).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}`
                                  : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className={
                                  s.status === 'canceled'
                                    ? 'text-muted-foreground'
                                    : s.cancelAtPeriodEnd
                                      ? 'text-yellow-500 border-yellow-500/40'
                                      : active
                                        ? 'text-green-500 border-green-500/40'
                                        : ''
                                }
                              >
                                {s.status === 'canceled'
                                  ? 'Canceled'
                                  : s.cancelAtPeriodEnd
                                    ? 'Ending'
                                    : s.status}
                              </Badge>
                              {s.status !== 'canceled' &&
                                (s.cancelAtPeriodEnd ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onResumeSubscription(s)}
                                    disabled={busy === `resume-${s.id}`}
                                  >
                                    {busy === `resume-${s.id}` && (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                    )}
                                    Resume
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCancelTarget(s)}
                                  >
                                    <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                                  </Button>
                                ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
              </TabsContent>

              <TabsContent value="customers" className="mt-4">
            {ready && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" /> Customers
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadCustomers}
                      disabled={customersLoading}
                    >
                      {customersLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!customers || customers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {customersLoading
                        ? 'Loading customers…'
                        : 'No customers yet. Everyone who pays through your links will be listed here.'}
                    </p>
                  ) : (
                    <>
                      <Input
                        placeholder="Search by name, email, or phone"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                      />
                      <div className="space-y-2">
                        {customers
                          .filter((c) => {
                            const q = customerSearch.trim().toLowerCase();
                            if (!q) return true;
                            return [c.name, c.email, c.phone]
                              .filter(Boolean)
                              .some((v) => String(v).toLowerCase().includes(q));
                          })
                          .slice(0, 50)
                          .map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card/40"
                            >
                              <div className="min-w-0">
                                <div className="font-medium truncate">
                                  {c.name || c.email || 'Client'}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {[c.email, c.phone].filter(Boolean).join(' · ') ||
                                    'No contact info'}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-semibold">
                                  {formatMoneyExact(c.totalSpent)}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {c.paymentCount} payment{c.paymentCount === 1 ? '' : 's'}
                                  {c.lastPayment
                                    ? ` · ${new Date(c.lastPayment * 1000).toLocaleDateString(
                                        'en-US',
                                        { month: 'short', day: 'numeric' }
                                      )}`
                                    : ''}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Lifetime totals are based on your most recent 100 payments.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
              </TabsContent>

              <TabsContent value="links" className="mt-4">
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
              </TabsContent>

              <TabsContent value="transactions" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-primary" /> Transactions
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={loadEarnings}
                        disabled={earningsLoading}
                      >
                        {earningsLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!ready ? (
                      <p className="text-sm text-muted-foreground">
                        Finish connecting Stripe to see your payments.
                      </p>
                    ) : !earnings || earnings.recent.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {earningsLoading
                          ? 'Loading your payments…'
                          : 'No payments yet — share your links to get your first one.'}
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {earnings.recent.map((p) => {
                            const remaining = p.amount - (p.amountRefunded ?? 0);
                            const fullyRefunded = remaining <= 0;
                            return (
                              <div
                                key={p.id}
                                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card/40"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium truncate">
                                    {p.customerName || p.customerEmail || 'Client payment'}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {p.description ? `${p.description} · ` : ''}
                                    {new Date(p.created * 1000).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">
                                    <div
                                      className={`font-semibold ${fullyRefunded ? 'line-through text-muted-foreground' : ''}`}
                                    >
                                      {formatMoneyExact(p.amount, p.currency)}
                                    </div>
                                    {(p.amountRefunded ?? 0) > 0 && (
                                      <div className="text-[11px] text-muted-foreground">
                                        {fullyRefunded
                                          ? 'Refunded'
                                          : `${formatMoneyExact(p.amountRefunded, p.currency)} refunded`}
                                      </div>
                                    )}
                                  </div>
                                  {!fullyRefunded && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setRefundTarget(p);
                                        setRefundAmount((remaining / 100).toFixed(2));
                                      }}
                                    >
                                      <Undo2 className="w-3.5 h-3.5 mr-1" />
                                      Refund
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Showing your most recent payments from the last 30 days. Amounts
                          are gross, before Stripe fees.
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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

        <Dialog
          open={!!refundTarget}
          onOpenChange={(o) => !o && setRefundTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Refund payment</DialogTitle>
              <DialogDescription>
                {refundTarget && (
                  <>
                    Refunding{' '}
                    {refundTarget.customerName ||
                      refundTarget.customerEmail ||
                      'this client'}
                    . The money goes back to their card in 5–10 business days.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="refund-amount">Refund amount (USD)</Label>
              <Input
                id="refund-amount"
                type="number"
                min="0.5"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave the full amount for a full refund, or lower it for a partial
                refund.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={onRefund}
                disabled={busy === 'refund'}
              >
                {busy === 'refund' && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!cancelTarget}
          onOpenChange={(o) => !o && setCancelTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel subscription</DialogTitle>
              <DialogDescription>
                {cancelTarget && (
                  <>
                    Canceling the plan for{' '}
                    {cancelTarget.customerName ||
                      cancelTarget.customerEmail ||
                      'this client'}
                    . You can end it now, or let them keep access until the current
                    period is over.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setCancelTarget(null)}>
                Keep it
              </Button>
              <Button
                variant="outline"
                onClick={() => onCancelSubscription(false)}
                disabled={busy === 'cancel'}
              >
                {busy === 'cancel' && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                End at period end
              </Button>
              <Button
                variant="destructive"
                onClick={() => onCancelSubscription(true)}
                disabled={busy === 'cancel'}
              >
                Cancel now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

    </DashboardLayout>
  );
}
