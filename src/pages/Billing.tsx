import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard, ExternalLink, Globe, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { memberBillingRequest, useMemberBilling } from '@/hooks/useMemberBilling';
import {
  cardLabel, domainOrderStatusLabel, formatCents, isStripeCheckoutUrl, takeSetupSessionFromSearch, type BillingCard,
} from '@/lib/memberBilling';

export default function Billing() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useMemberBilling();
  const [busy, setBusy] = useState('');
  const [removing, setRemoving] = useState<BillingCard | null>(null);
  const handledReturn = useRef(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['member-billing'] });

  useEffect(() => {
    if (handledReturn.current) return;
    handledReturn.current = true;
    const { sessionId, rest } = takeSetupSessionFromSearch(window.location.search);
    const cancelled = new URLSearchParams(window.location.search).get('setup') === 'cancelled';
    if (sessionId || cancelled) window.history.replaceState(null, '', `${window.location.pathname}${rest}`);
    if (cancelled) toast.info('No card was added.');
    if (!sessionId) return;
    setBusy('Confirming card');
    memberBillingRequest({ action: 'setup-complete', sessionId })
      .then(() => { toast.success('Card saved for future Barber Launch purchases.'); return refresh(); })
      .catch(err => toast.error(err instanceof Error ? err.message : 'Card setup could not be confirmed.'))
      .finally(() => setBusy(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCard = async () => {
    setBusy('Opening secure card form');
    try {
      const result = await memberBillingRequest<{ url?: string }>({ action: 'setup' });
      if (!isStripeCheckoutUrl(result.url)) throw new Error('Secure card form returned an unexpected address.');
      window.location.assign(result.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open the secure card form.');
      setBusy('');
    }
  };

  const removeCard = async () => {
    if (!removing) return;
    const card = removing;
    setRemoving(null);
    setBusy(`Removing ${card.id}`);
    try {
      await memberBillingRequest({ action: 'remove-card', paymentMethodId: card.id });
      toast.success('Card removed.');
      await refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not remove the card.'); }
    finally { setBusy(''); }
  };

  const cards = data?.cards ?? [];
  const orders = data?.orders ?? [];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Billing</h1>
          <p className="text-muted-foreground text-sm mt-1">Your saved cards and domain purchases. Card details are kept by Stripe, never by Barber Launch.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : isError ? (
          <div role="alert" className="space-y-3 text-sm text-destructive">
            <p>{error instanceof Error ? error.message : 'Billing is unavailable right now.'}</p>
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold">Saved cards</h2>
                  </div>
                  <Button onClick={() => void addCard()} disabled={!!busy} className="gold-gradient text-primary-foreground font-semibold shrink-0">
                    {busy === 'Opening secure card form' || busy === 'Confirming card' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    {cards.length ? 'Add or replace a card' : 'Add a card'}
                  </Button>
                </div>
                {data?.customer.status === 'unresolved' && (
                  <p className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
                    Cards from past purchases are hidden because we couldn't confirm they belong only to your account. You can add a new card or pay with a new card at checkout.
                  </p>
                )}
                {cards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved cards. You can enter a new card whenever you pay.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {cards.map(card => (
                      <li key={card.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="font-medium break-words">{cardLabel(card)}</span>
                          {card.isDefault && <Badge variant="secondary">Default</Badge>}
                          {card.expired && <Badge variant="destructive">Expired</Badge>}
                        </div>
                        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => setRemoving(card)} className="self-start sm:self-auto">
                          {busy === `Removing ${card.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                  Cards are added on Stripe's secure page. A saved card is only charged when you choose it and confirm a purchase.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold">Domain purchases</h2>
                </div>
                {orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No domain purchases yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {orders.map(order => (
                      <li key={order.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium break-all">{order.domain}</p>
                          <p className="text-sm text-muted-foreground">
                            {domainOrderStatusLabel(order.status)} · {formatCents(order.member_charge_cents, order.currency)} · {new Date(order.created_at).toLocaleDateString()}
                          </p>
                          {order.status === 'action_required' && <p className="text-sm text-destructive">Contact Barber Launch Support about this order.</p>}
                        </div>
                        {order.receipt_url && (
                          <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
                            <a href={order.receipt_url} target="_blank" rel="noopener noreferrer">Stripe receipt <ExternalLink className="w-3.5 h-3.5 ml-1.5" /></a>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <AlertDialog open={!!removing} onOpenChange={open => { if (!open) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this card?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing ? cardLabel(removing) : ''} will no longer be offered for Barber Launch purchases. Past payments are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep card</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeCard()}>Remove card</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
