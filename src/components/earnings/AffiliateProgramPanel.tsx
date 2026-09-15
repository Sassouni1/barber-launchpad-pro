import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Copy, Link2, Loader2, Megaphone, Smartphone, Users, UserRoundPlus, WalletCards, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export type Totals = {
  referrals: number;
  verifiedCents: number;
  pendingCents: number;
  paidCents: number;
  adjustmentCents: number;
};

export type PortalData = {
  enrolled: boolean;
  affiliate?: { code: string; displayName: string | null; status: string; rate: number };
  totals?: Totals;
  commissions?: Array<{
    id: string;
    entry_type: string;
    source?: string;
    amount_cents: number;
    status: string;
    note: string | null;
    created_at: string;
  }>;
  payouts?: Array<{ id: string; amount_cents: number; method: string | null; external_reference: string | null; paid_at: string }>;
  referrals?: Array<{ id: string; linkType: string; status: string; createdAt: string }>;
  checkoutReady?: boolean;
};

export const money = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

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

const LESSON_STEPS = [
  { number: '1', title: 'Share your link', text: 'Send a barber to Barber Launch.', icon: Link2 },
  { number: '2', title: 'They enroll', text: 'Your link keeps you credited.', icon: UserRoundPlus },
  { number: '3', title: 'You earn $600', text: '20% of each $3,000 enrollment.', icon: WalletCards },
];

const MATERIALS = [
  { title: 'Social posts', icon: Megaphone },
  { title: 'Story templates', icon: Smartphone },
  { title: 'Before & after', icon: ImageIcon },
];

export function AffiliateProgramPanel({
  data,
  onEnroll,
  joining,
}: {
  data: PortalData | null;
  onEnroll: () => void;
  joining: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!data) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  if (!data.enrolled) {
    return (
      <div className="space-y-4 max-w-2xl">
        <p className="text-muted-foreground">
          Earn 20% of the enrollment when someone you refer joins Barber Launch — $600 on a $3,000 enrollment.
          Commission is only counted once the payment actually clears.
        </p>
        <Button onClick={onEnroll} disabled={joining} size="lg">
          {joining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
          Get my referral links
        </Button>
      </div>
    );
  }

  const t = data.totals!;
  const suspended = data.affiliate?.status === 'suspended';
  const linkFor = (kind: string) => `${window.location.origin}/refer/${data.affiliate?.code}/${kind}`;

  const copy = async (kind: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(kind));
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Long-press the link to copy it manually.', variant: 'destructive' });
    }
  };

  const affiliateCommissions = (data.commissions ?? []).filter((c) => (c.source ?? 'affiliate') === 'affiliate');

  return (
    <div className="space-y-6">
      {suspended && (
        <Alert variant="destructive">
          <AlertDescription>Your affiliate account is paused. Contact the Barber Launch team.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {LESSON_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.number} className="relative text-center">
              <CardContent className="p-5">
                <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-full border border-primary text-sm font-semibold text-primary">{step.number}</div>
                <Icon className="mx-auto mb-3 h-6 w-6 text-primary" />
                <div className="font-semibold">{step.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{step.text}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(t.referrals > 0 || t.verifiedCents !== 0 || t.paidCents !== 0) && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Referrals', value: String(t.referrals) },
            { label: 'Earned', value: money(t.verifiedCents) },
            { label: 'Paid', value: money(t.paidCents) },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-lg font-semibold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Choose the right link</h2>
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

      <div className="border-t border-border pt-6">
        <h2 className="text-xl font-semibold">Marketing materials</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ready-to-share posts, stories, and before-and-after assets.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {MATERIALS.map((material) => {
            const Icon = material.icon;
            return (
              <Card key={material.title}>
                <CardContent className="p-5 text-center">
                  <Icon className="mx-auto mb-3 h-6 w-6 text-primary" />
                  <div className="font-medium">{material.title}</div>
                  <div className="mt-2 text-xs text-muted-foreground">Coming soon</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Commission history</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {affiliateCommissions.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing yet. Commission appears here once a referred payment clears.</p>
          )}
          {affiliateCommissions.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
              <div className="min-w-0">
                <div className="capitalize">{c.entry_type === 'earned' ? 'Commission' : c.entry_type}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString()}{c.note ? ` \u2014 ${c.note}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant="outline" className="capitalize">{c.status}</Badge>
                <span className={c.amount_cents < 0 ? 'text-destructive font-medium' : 'font-medium'}>{money(c.amount_cents)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {(data.payouts ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Payments sent outside Stripe</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data.payouts ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                <div>
                  <div>{p.method ?? 'Payout'}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.paid_at).toLocaleDateString()}{p.external_reference ? ` \u2014 ${p.external_reference}` : ''}
                  </div>
                </div>
                <span className="font-medium">{money(p.amount_cents)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
