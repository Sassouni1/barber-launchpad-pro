import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ContentReviewPanel } from '@/components/earnings/ContentReviewPanel';

const money = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

type Overview = {
  settings: any;
  missingConfig: string[];
  affiliates: any[];
  referrals: any[];
  payments: any[];
  commissions: any[];
  payouts: any[];
  missingPayoutConfig?: string[];
  transfers?: any[];
  payoutAccounts?: any[];
};

export default function AffiliatesAdmin() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [payout, setPayout] = useState({ affiliateId: '', amount: '', method: '', reference: '', note: '' });
  const [reconcile, setReconcile] = useState({ paymentId: '', referralId: '', reason: '' });
  const [checkoutLinks, setCheckoutLinks] = useState<Record<string, string>>({});
  const [linkBusy, setLinkBusy] = useState<string | null>(null);

  const call = async (body: Record<string, unknown>) => {
    const { data: res, error } = await supabase.functions.invoke('affiliate-admin', { body });
    if (error || (res as any)?.error) {
      toast({ title: 'That did not work', description: (res as any)?.error ?? 'Please try again.', variant: 'destructive' });
      return null;
    }
    return res as any;
  };

  const load = async () => {
    const res = await call({ action: 'overview' });
    if (res) {
      setData(res);
      setSettings(res.settings ?? {});
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const affiliateName = useMemo(() => {
    const map = new Map<string, string>();
    (data?.affiliates ?? []).forEach((a) => map.set(a.id, a.display_name || a.contact_email || a.code));
    return map;
  }, [data]);

  const saveSettings = async () => {
    setBusy(true);
    const priceIds = String(settings.enrollment_price_ids_text ?? (settings.enrollment_price_ids ?? []).join(', '))
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const res = await call({
      action: 'save_settings',
      settings: {
        live_enabled: Boolean(settings.live_enabled),
        expected_seller_account_id: settings.expected_seller_account_id || null,
        enrollment_price_ids: priceIds,
        sales_call_url: settings.sales_call_url || null,
        attribution_window_days: settings.attribution_window_days ? Number(settings.attribution_window_days) : null,
        payout_timing: settings.payout_timing || null,
        terms_text: settings.terms_text || null,
        auto_payouts_enabled: Boolean(settings.auto_payouts_enabled),
        release_timing: settings.release_timing || null,
        release_delay_days: settings.release_delay_days ? Number(settings.release_delay_days) : null,
        minimum_transfer_cents: settings.minimum_transfer_cents ? Number(settings.minimum_transfer_cents) : 100,
        scheduler_enabled: Boolean(settings.scheduler_enabled),
      },
    });
    setBusy(false);
    if (res) {
      toast({ title: 'Setup saved' });
      load();
    }
  };

  if (loading) {
    return <DashboardLayout><div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Affiliates</h1>

        {(data?.missingConfig?.length ?? 0) > 0 && (
          <Alert>
            <AlertDescription>
              <div className="font-medium mb-1">Enrollment checkout is switched off until these are set:</div>
              <ul className="list-disc pl-5 text-sm">
                {data!.missingConfig.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="affiliates">
          <TabsList className="flex-wrap">
            <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="setup">Setup</TabsTrigger>
          </TabsList>

          <TabsContent value="affiliates" className="space-y-3 pt-4">
            {(data?.affiliates ?? []).length === 0 && <p className="text-sm text-muted-foreground">No affiliates yet.</p>}
            {(data?.affiliates ?? []).map((a) => {
              const net = (data?.commissions ?? [])
                .filter((c) => c.affiliate_id === a.id && c.entry_type !== 'payout')
                .reduce((s, c) => s + Number(c.amount_cents), 0);
              const paid = (data?.payouts ?? [])
                .filter((p) => p.affiliate_id === a.id)
                .reduce((s, p) => s + Number(p.amount_cents), 0);
              return (
                <Card key={a.id}>
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                    <div className="min-w-0">
                      <div className="font-medium">{a.display_name || a.contact_email || a.code}</div>
                      <div className="text-xs text-muted-foreground font-mono">{a.code} · {a.contact_email ?? 'no email'}</div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span>Earned {money(net)}</span>
                      <span className="text-muted-foreground">Paid {money(paid)}</span>
                      <Badge variant={a.status === 'active' ? 'outline' : 'destructive'}>{a.status}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await call({ action: 'set_status', affiliateId: a.id, status: a.status === 'active' ? 'suspended' : 'active' });
                          load();
                        }}
                      >
                        {a.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="leads" className="space-y-3 pt-4">
            <Alert>
              <AlertDescription className="text-sm">
                Closed someone on a call? Create the tracked $3,000 checkout for their lead below and send them that
                link. The referral stays credited to the affiliate even if they pay days later on a different device.
              </AlertDescription>
            </Alert>
            {(data?.referrals ?? []).length === 0 && <p className="text-sm text-muted-foreground">No leads yet.</p>}
            {(data?.referrals ?? []).map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 text-sm space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{r.lead_name || 'Unnamed lead'}</div>
                      <div className="text-muted-foreground">{r.lead_email}{r.lead_phone ? ` · ${r.lead_phone}` : ''}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{r.link_type}</Badge>
                      <Badge variant="outline">{r.status}</Badge>
                      <span className="text-muted-foreground">{affiliateName.get(r.affiliate_id) ?? '—'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={linkBusy === r.id}
                      onClick={async () => {
                        setLinkBusy(r.id);
                        const res = await call({ action: 'create_referral_checkout', referralId: r.id });
                        setLinkBusy(null);
                        if (res?.url) {
                          setCheckoutLinks((prev) => ({ ...prev, [r.id]: res.url }));
                          toast({ title: 'Tracked checkout created' });
                        }
                      }}
                    >
                      {linkBusy === r.id ? 'Creating…' : 'Create tracked $3,000 checkout'}
                    </Button>
                    {checkoutLinks[r.id] && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(checkoutLinks[r.id]);
                            toast({ title: 'Payment link copied' });
                          } catch {
                            toast({ title: 'Copy failed', description: 'Select the link and copy it manually.' });
                          }
                        }}
                      >
                        Copy payment link
                      </Button>
                    )}
                  </div>
                  {checkoutLinks[r.id] && (
                    <p className="text-xs break-all text-muted-foreground font-mono">{checkoutLinks[r.id]}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="payments" className="space-y-3 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reconcile a verified payment</CardTitle>
                <CardDescription>
                  Only payments already recorded from a signed Stripe event with an approved enrollment price can be matched.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Payment ID</Label>
                    <Input value={reconcile.paymentId} onChange={(e) => setReconcile({ ...reconcile, paymentId: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Referral ID</Label>
                    <Input value={reconcile.referralId} onChange={(e) => setReconcile({ ...reconcile, referralId: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Reason</Label>
                    <Input value={reconcile.reason} onChange={(e) => setReconcile({ ...reconcile, reason: e.target.value })} />
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    const res = await call({ action: 'reconcile_payment', ...reconcile });
                    if (res) { toast({ title: 'Payment matched' }); setReconcile({ paymentId: '', referralId: '', reason: '' }); load(); }
                  }}
                >
                  Match payment to referral
                </Button>
              </CardContent>
            </Card>

            {(data?.payments ?? []).map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{money(p.eligible_amount_cents)} {p.currency?.toUpperCase()}</span>
                    <div className="flex gap-2">
                      {!p.livemode && <Badge variant="outline">test</Badge>}
                      {p.disputed && <Badge variant="destructive">disputed</Badge>}
                      {p.refunded_amount_cents > 0 && <Badge variant="outline">refunded {money(p.refunded_amount_cents)}</Badge>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono break-all">{p.id}</div>
                  <div className="text-xs text-muted-foreground break-all">{p.stripe_object_id} · {p.price_id ?? 'no price'} · {p.customer_email_normalized ?? 'no email'}</div>
                  <div className="text-xs text-muted-foreground">{p.affiliate_id ? `Credited to ${affiliateName.get(p.affiliate_id) ?? p.affiliate_id}` : 'Unmatched'}</div>
                </CardContent>
              </Card>
            ))}
            {(data?.payments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No verified payments recorded yet.</p>}
          </TabsContent>

          <TabsContent value="payouts" className="space-y-3 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Automatic commission payouts</CardTitle>
                <CardDescription>
                  Commission is sent straight to each affiliate's connected Stripe account. This is the normal way
                  affiliates get paid.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.missingPayoutConfig?.length ?? 0) > 0 ? (
                  <Alert>
                    <AlertDescription>
                      <div className="font-medium mb-1">Automatic payouts are not running yet:</div>
                      <ul className="list-disc pl-5 text-sm">
                        {data!.missingPayoutConfig!.map((m) => <li key={m}>{m}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert><AlertDescription>Automatic payouts are switched on.</AlertDescription></Alert>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const res = await call({ action: 'run_dispatch', dryRun: true });
                      if (res) { toast({ title: 'Dry run finished', description: `${res.processed?.length ?? 0} queued item(s) checked. No money moved.` }); load(); }
                    }}
                  >
                    Dry run (moves no money)
                  </Button>
                  <Button
                    disabled={(data?.missingPayoutConfig?.length ?? 1) > 0}
                    onClick={async () => {
                      const res = await call({ action: 'run_dispatch', dryRun: false });
                      if (res) { toast({ title: 'Payout run finished' }); load(); }
                    }}
                  >
                    Send due payouts now
                  </Button>
                </div>
                {(data?.transfers ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No commission transfers queued yet.</p>
                )}
                {(data?.transfers ?? []).map((tr) => (
                  <div key={tr.id} className="rounded-md border border-border p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{money(tr.amount_cents)}</span>
                      <div className="flex items-center gap-2">
                        {!tr.livemode && <Badge variant="outline">test</Badge>}
                        <Badge variant="outline">{tr.status}</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground break-all">
                      {affiliateName.get(tr.affiliate_id) ?? tr.affiliate_id}
                      {tr.destination_account_id ? ` · ${tr.destination_account_id}` : ''}
                      {tr.stripe_transfer_id ? ` · ${tr.stripe_transfer_id}` : ''}
                    </div>
                    {tr.failure_message && <div className="text-xs text-destructive">{tr.failure_message}</div>}
                    {!['sent', 'paid'].includes(tr.status) && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={async () => {
                          const reason = window.prompt('Reason for retrying this transfer?')?.trim();
                          if (!reason) return;
                          const res = await call({ action: 'retry_transfer', transferId: tr.id, reason });
                          if (res) { toast({ title: 'Queued for retry' }); load(); }
                        }}>Retry</Button>
                        <Button size="sm" variant="outline" onClick={async () => {
                          const reason = window.prompt('Reason for canceling this transfer?')?.trim();
                          if (!reason) return;
                          const res = await call({ action: 'cancel_transfer', transferId: tr.id, reason });
                          if (res) { toast({ title: 'Transfer canceled' }); load(); }
                        }}>Cancel</Button>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Record a payment sent outside Stripe</CardTitle>
                <CardDescription>
                  Exception only. This records a payment you already sent by hand — it does not move money.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Affiliate ID</Label>
                    <Input value={payout.affiliateId} onChange={(e) => setPayout({ ...payout, affiliateId: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Amount (USD)</Label>
                    <Input value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: e.target.value })} inputMode="decimal" />
                  </div>
                  <div className="space-y-1">
                    <Label>Method</Label>
                    <Input value={payout.method} onChange={(e) => setPayout({ ...payout, method: e.target.value })} placeholder="Zelle, wire, check…" />
                  </div>
                  <div className="space-y-1">
                    <Label>Reference</Label>
                    <Input value={payout.reference} onChange={(e) => setPayout({ ...payout, reference: e.target.value })} />
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    const res = await call({
                      action: 'record_payout',
                      affiliateId: payout.affiliateId,
                      amountCents: Math.round(Number(payout.amount) * 100),
                      method: payout.method,
                      reference: payout.reference,
                      note: payout.note,
                    });
                    if (res) { toast({ title: 'Payout recorded' }); setPayout({ affiliateId: '', amount: '', method: '', reference: '', note: '' }); load(); }
                  }}
                >
                  Record payout
                </Button>
              </CardContent>
            </Card>

            {(data?.payouts ?? []).map((p) => (
              <Card key={p.id}><CardContent className="p-4 text-sm flex justify-between">
                <span>{affiliateName.get(p.affiliate_id) ?? p.affiliate_id} · {p.method}</span>
                <span className="font-medium">{money(p.amount_cents)}</span>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="content" className="pt-4">
            <ContentReviewPanel />
          </TabsContent>

          <TabsContent value="setup" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Program setup</CardTitle>
                <CardDescription>
                  These choices are yours to make — nothing here is assumed. Checkout stays off until the seller account,
                  price and call link are confirmed and live mode is on.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 rounded-md border border-border p-3">
                  <Label>Enrollment seller Stripe account</Label>
                  <Input
                    value={settings.expected_seller_account_id ?? ''}
                    onChange={(e) => setSettings({ ...settings, expected_seller_account_id: e.target.value })}
                    placeholder="acct_…"
                  />
                  <p className="text-xs text-muted-foreground">
                    The check asks Stripe which account the server-side key belongs to and compares it with this id.
                    It never creates a charge. It cannot be ticked by hand.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        const res = await call({ action: 'verify_seller_account', expectedAccountId: settings.expected_seller_account_id });
                        setBusy(false);
                        if (res) {
                          toast({
                            title: res.matches ? 'Seller account matches' : 'Seller account does NOT match',
                            description: `Stripe key belongs to ${res.accountId}${res.accountEmail ? ` (${res.accountEmail})` : ''}`,
                            variant: res.matches ? undefined : 'destructive',
                          });
                          load();
                        }
                      }}
                    >
                      Check the Stripe key's account
                    </Button>
                    {data?.settings?.verified_stripe_account_id && (
                      <Badge variant={data.settings.seller_account_confirmed ? 'outline' : 'destructive'}>
                        key = {data.settings.verified_stripe_account_id}
                        {data.settings.seller_account_confirmed ? ' · matches' : ' · mismatch'}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Approved enrollment price IDs (comma separated)</Label>
                  <Input
                    value={settings.enrollment_price_ids_text ?? (settings.enrollment_price_ids ?? []).join(', ')}
                    onChange={(e) => setSettings({ ...settings, enrollment_price_ids_text: e.target.value })}
                    placeholder="price_…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Chris's offer is $3,000 with 20% = $600. The existing live product is $2,997, where 20% is $599.40.
                    If you want an exact $600 commission, create a separate $3,000 enrollment price and put it here —
                    the existing $2,997 link is left untouched.
                  </p>
                </div>

                {data?.settings?.external_payment_link_url && (
                  <Alert>
                    <AlertDescription className="text-sm space-y-1">
                      <div className="font-medium">Existing payment link is not auto-tracked</div>
                      <div className="break-all text-muted-foreground">{data.settings.external_payment_link_url}</div>
                      <div className="text-muted-foreground">
                        Product {data.settings.external_payment_product_id} ·{' '}
                        {data.settings.external_payment_amount_cents ? money(data.settings.external_payment_amount_cents) : '—'}
                      </div>
                      <div>
                        That link runs through the outside payment page, not a Stripe Checkout Session, so commission is
                        not accrued from it automatically. Sales made through it must be matched under Payments, using a
                        real verified payment record.
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-1">
                  <Label>Sales call booking URL</Label>
                  <Input value={settings.sales_call_url ?? ''} onChange={(e) => setSettings({ ...settings, sales_call_url: e.target.value })} />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Attribution window (days, blank = no expiry)</Label>
                    <Input value={settings.attribution_window_days ?? ''} onChange={(e) => setSettings({ ...settings, attribution_window_days: e.target.value })} inputMode="numeric" />
                  </div>
                  <div className="space-y-1">
                    <Label>Payout timing</Label>
                    <Input value={settings.payout_timing ?? ''} onChange={(e) => setSettings({ ...settings, payout_timing: e.target.value })} placeholder="e.g. monthly, 30 days after refund window" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Affiliate terms shown to affiliates</Label>
                  <Textarea rows={5} value={settings.terms_text ?? ''} onChange={(e) => setSettings({ ...settings, terms_text: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(settings.live_enabled)} onChange={(e) => setSettings({ ...settings, live_enabled: e.target.checked })} />
                  Enable live enrollment checkout
                </label>

                <div className="space-y-3 rounded-md border border-border p-3">
                  <div>
                    <Label>Automatic affiliate payouts</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Commission is transferred to each affiliate's connected Stripe account. Nothing sends until the
                      transfer path is verified, a release timing is chosen, and the switch below is on.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const res = await call({ action: 'verify_platform_transfers' });
                        if (res) { toast({ title: res.verified ? 'Transfer path verified' : 'Not verified', description: res.note }); load(); }
                      }}
                    >
                      Check the transfer path
                    </Button>
                    {data?.settings?.platform_transfer_checked_at && (
                      <Badge variant={data.settings.platform_transfer_verified ? 'outline' : 'destructive'}>
                        {data.settings.platform_transfer_verified ? 'verified' : 'not verified'}
                      </Badge>
                    )}
                  </div>
                  {data?.settings?.platform_transfer_note && (
                    <p className="text-xs text-muted-foreground">{data.settings.platform_transfer_note}</p>
                  )}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Release timing</Label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={settings.release_timing ?? ''}
                        onChange={(e) => setSettings({ ...settings, release_timing: e.target.value || null })}
                      >
                        <option value="">Not chosen yet</option>
                        <option value="on_verified">As soon as the payment clears</option>
                        <option value="after_days">Hold for a number of days first</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Days to hold (only for "hold")</Label>
                      <Input
                        value={settings.release_delay_days ?? ''}
                        onChange={(e) => setSettings({ ...settings, release_delay_days: e.target.value })}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.auto_payouts_enabled)}
                      onChange={(e) => setSettings({ ...settings, auto_payouts_enabled: e.target.checked })}
                    />
                    Turn on automatic payouts
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.scheduler_enabled)}
                      onChange={(e) => setSettings({ ...settings, scheduler_enabled: e.target.checked })}
                    />
                    Let the hourly timer run payouts by itself
                  </label>
                  <p className="text-xs text-muted-foreground">
                    The hourly timer is installed and already calls the payout runner, but every run stops immediately
                    and does nothing until this box is ticked and the release timing above is chosen.
                  </p>
                </div>
                <Button onClick={saveSettings} disabled={busy}>
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save setup
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
