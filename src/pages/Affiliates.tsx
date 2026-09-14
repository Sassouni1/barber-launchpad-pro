import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Banknote, Check, Copy, Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type PayoutAccount = {
  connected: boolean;
  eligible: boolean;
  reason?: string | null;
  payoutsEnabled?: boolean;
  bank?: { last4: string; name: string | null } | null;
  needsInfo?: boolean;
  pendingVerification?: boolean;
};

type PayoutData = {
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

type Totals = {
  referrals: number;
  verifiedCents: number;
  pendingCents: number;
  paidCents: number;
  adjustmentCents: number;
};

type PortalData = {
  enrolled: boolean;
  affiliate?: { code: string; displayName: string | null; status: string; rate: number };
  totals?: Totals;
  commissions?: Array<{ id: string; entry_type: string; amount_cents: number; status: string; note: string | null; created_at: string }>;
  payouts?: Array<{ id: string; amount_cents: number; method: string | null; external_reference: string | null; paid_at: string }>;
  referrals?: Array<{ id: string; linkType: string; status: string; createdAt: string }>;
  checkoutReady?: boolean;
};

const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const LINK_CARDS = [
  {
    key: 'call' as const,
    title: 'Sales call funnel',
    text: 'Use this if you want the person to speak with the Barber Launch team first. It still gets accounted to you. Don\u2019t worry.',
  },
  {
    key: 'pay' as const,
    title: 'Direct payment',
    text: 'If you\u2019re confident that this person will sign up right now without needing a call, use this link.',
  },
  {
    key: 'both' as const,
    title: 'Both',
    text: 'If you\u2019re not really sure, use this link.',
  },
];

export default function Affiliates() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<PayoutData | null>(null);
  const [payoutBusy, setPayoutBusy] = useState(false);

  const loadPayouts = async () => {
    const { data: res, error } = await supabase.functions.invoke('affiliate-payouts', { body: { action: 'status' } });
    if (!error) setPayouts(res as PayoutData);
  };

  const startPayoutSetup = async () => {
    setPayoutBusy(true);
    const { data: res, error } = await supabase.functions.invoke('affiliate-payouts', {
      body: { action: 'start_onboarding' },
    });
    setPayoutBusy(false);
    const url = (res as { url?: string } | null)?.url;
    if (error || !url) {
      toast({ title: 'Could not open payout setup', description: 'Please try again in a moment.', variant: 'destructive' });
      return;
    }
    window.location.href = url;
  };

  const load = async (action: 'summary' | 'enroll' = 'summary') => {
    const { data: res, error } = await supabase.functions.invoke('affiliate-portal', { body: { action } });
    if (error) {
      toast({ title: 'Could not load your affiliate details', description: 'Please try again in a moment.', variant: 'destructive' });
      return null;
    }
    setData(res as PortalData);
    return res as PortalData;
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const join = async () => {
    setJoining(true);
    await load('enroll');
    setJoining(false);
  };

  const linkFor = (kind: string) => `${window.location.origin}/refer/${data?.affiliate?.code}/${kind}`;

  const copy = async (kind: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(kind));
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Long-press the link to copy it manually.', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  if (!data?.enrolled) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Affiliate Program</h1>
            <p className="text-muted-foreground mt-2">
              Earn 20% of the enrollment when someone you refer joins Barber Launch — $600 on a $3,000 enrollment.
              Commission is only counted once the payment actually clears.
            </p>
          </div>
          <Button onClick={join} disabled={joining} size="lg">
            {joining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
            Get my referral links
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const t = data.totals!;
  const suspended = data.affiliate?.status === 'suspended';

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Affiliate Program</h1>
          <p className="text-muted-foreground mt-1">Your code: <span className="font-mono text-foreground">{data.affiliate?.code}</span></p>
        </div>

        {suspended && (
          <Alert variant="destructive">
            <AlertDescription>Your affiliate account is paused. Contact the Barber Launch team.</AlertDescription>
          </Alert>
        )}

        {!data.checkoutReady && (
          <Alert>
            <AlertDescription>
              Online enrollment checkout isn’t switched on yet. Your links still save every referral, and the team
              closes the sale on the call — you stay credited.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Referrals saved', value: String(t.referrals) },
            { label: 'Verified', value: money(t.verifiedCents) },
            { label: 'Pending review', value: money(t.pendingCents) },
            { label: 'Paid out', value: money(t.paidCents) },
            { label: 'Adjustments', value: money(t.adjustmentCents) },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-lg font-semibold mt-1">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          {LINK_CARDS.map((card) => (
            <Card key={card.key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{card.title}</CardTitle>
                <CardDescription>{card.text}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 min-w-0 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm font-mono truncate">
                  {linkFor(card.key)}
                </div>
                <Button onClick={() => copy(card.key)} className="shrink-0">
                  {copied === card.key ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied === card.key ? 'Copied' : 'Copy link'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Commission history</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data.commissions ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing yet. Commission appears here once a referred payment clears.</p>
            )}
            {(data.commissions ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                <div className="min-w-0">
                  <div className="capitalize">{c.entry_type === 'earned' ? 'Commission' : c.entry_type}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}{c.note ? ` \u2014 ${c.note}` : ''}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className="capitalize">{c.status}</Badge>
                  <span className={c.amount_cents < 0 ? 'text-destructive font-medium' : 'font-medium'}>{money(c.amount_cents)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Payouts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data.payouts ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No payouts recorded yet.</p>
            )}
            {(data.payouts ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                <div>
                  <div>{p.method ?? 'Payout'}</div>
                  <div className="text-xs text-muted-foreground">{new Date(p.paid_at).toLocaleDateString()}{p.external_reference ? ` \u2014 ${p.external_reference}` : ''}</div>
                </div>
                <span className="font-medium">{money(p.amount_cents)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
