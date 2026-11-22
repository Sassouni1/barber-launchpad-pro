import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Search, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Grant = { id: string; source: string; status: string; status_reason: string | null; amount_cents: number | null; paid_at: string | null; note: string | null };
type Suggestion = { id: string; email_normalized: string; amount_cents: number; paid_at: string | null; description: string | null };
type Account = {
  id: string; email: string | null; name: string | null; createdAt: string; lastSignInAt: string | null; roles: string[];
  hasAccess: boolean; grants: Grant[]; signals: { certified: boolean; legacyOrders: number }; suggestions?: Suggestion[];
};
type Summary = { accounts: number; admins: number; manufacturers: number; membersWithAccess: number; membersWithoutAccess: number };
type ListResponse = { enforced: boolean; summary: Summary; accounts: Account[]; unmatchedGrants: Grant[] };

const SOURCE_LABEL: Record<string, string> = {
  stripe_checkout: 'Stripe checkout',
  stripe_charge: 'Stripe payment',
  ghl_transaction: 'GoHighLevel payment',
  hair_system_order: 'Paid hair-system order',
  admin_grant: 'Granted by admin',
  owner_legacy_confirmation: 'Confirmed by owner',
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('member-access-admin', { body });
  if (error) {
    const ctx = (error as any).context;
    let msg = error.message;
    try { const j = await ctx?.json?.(); if (j?.error) msg = j.error; } catch { /* keep message */ }
    throw new Error(msg);
  }
  return data as T;
}

const money = (c: number | null) => (c == null ? '' : `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

type Pending =
  | { kind: 'grant' | 'revoke'; account: Account }
  | { kind: 'link'; account: Account; suggestion: Suggestion }
  | { kind: 'switch'; enable: boolean };

export default function MemberAccess() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'without' | 'with' | 'all'>('without');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [confirmCount, setConfirmCount] = useState('');

  const list = useQuery({ queryKey: ['member-access-list'], queryFn: () => call<ListResponse>({ action: 'list' }), staleTime: 300000 });

  const act = useMutation({
    mutationFn: async (p: Pending) => {
      switch (p.kind) {
        case 'grant': return call({ action: 'grant', userId: p.account.id, reason });
        case 'revoke': return call({ action: 'revoke', userId: p.account.id, reason });
        case 'link': return call({ action: 'linkEvidence', userId: p.account.id, evidenceId: p.suggestion.id, reason });
        case 'switch': return call({ action: 'setEnforcement', enabled: p.enable, reason, confirmUnentitledCount: Number(confirmCount) });
      }
    },
    onSuccess: () => {
      toast.success('Saved');
      setPending(null); setReason(''); setConfirmCount('');
      void qc.invalidateQueries({ queryKey: ['member-access-list'] });
    },
    onError: (e: Error) => toast.error(e.message.replace(/_/g, ' ')),
  });

  const recheck = useMutation({
    mutationFn: async () => {
      await call({ action: 'auditStripe' });
      return call<{ inserted: number; newlyCoveredAccounts: number }>({ action: 'applyEvidence', dryRun: false });
    },
    onSuccess: (r) => { toast.success(`Stripe re-checked: ${r.newlyCoveredAccounts} more account(s) matched`); void qc.invalidateQueries({ queryKey: ['member-access-list'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const accounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data?.accounts ?? [])
      .filter((a) => !a.roles.includes('manufacturer') || a.roles.includes('admin'))
      .filter((a) => filter === 'all' || (filter === 'with' ? a.hasAccess : !a.hasAccess))
      .filter((a) => !q || `${a.email} ${a.name ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [list.data, filter, search]);

  const s = list.data?.summary;
  const reasonOk = reason.trim().length >= 5;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Member Access</h1>
          <p className="text-muted-foreground">Who can open member training, and the purchase or decision behind it.</p>
        </header>

        {list.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : list.isError ? (
          <div role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm">
            Access records couldn't load. <Button variant="link" onClick={() => list.refetch()}>Try again</Button>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className={cn('rounded-xl border p-4', list.data?.enforced ? 'border-primary/50 bg-primary/10' : 'border-border bg-card')}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Access check</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{list.data?.enforced ? 'On' : 'Off'}</p>
                <p className="text-xs text-muted-foreground">{list.data?.enforced ? 'Only matched members get in' : 'Every signed-in account gets in'}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">With access</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{s?.membersWithAccess}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Without access</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{s?.membersWithoutAccess}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Purchases, no account yet</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{list.data?.unmatchedGrants.filter((g) => g.status === 'active').length}</p>
              </div>
            </section>

            <section className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => recheck.mutate()} disabled={recheck.isPending}>
                {recheck.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Re-check Stripe payments
              </Button>
              {list.data?.enforced ? (
                <Button variant="outline" onClick={() => setPending({ kind: 'switch', enable: false })}><ShieldOff className="mr-2 h-4 w-4" />Turn access check off</Button>
              ) : (
                <Button onClick={() => setPending({ kind: 'switch', enable: true })}><ShieldCheck className="mr-2 h-4 w-4" />Turn access check on</Button>
              )}
            </section>

            <section className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex gap-2" role="group" aria-label="Filter accounts">
                {(['without', 'with', 'all'] as const).map((f) => (
                  <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} aria-pressed={filter === f}>
                    {f === 'without' ? 'Without access' : f === 'with' ? 'With access' : 'All'}
                  </Button>
                ))}
              </div>
              <div className="relative sm:ml-auto sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search accounts" />
              </div>
            </section>

            <ul className="space-y-3">
              {accounts.map((a) => (
                <li key={a.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{a.name || 'No name'}</p>
                      <p className="text-sm text-muted-foreground break-all">{a.email}</p>
                      <p className="text-xs text-muted-foreground">Joined {day(a.createdAt)} · Last sign-in {day(a.lastSignInAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={a.hasAccess ? 'default' : 'outline'}>{a.hasAccess ? 'Has access' : 'No access'}</Badge>
                      {a.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                      {a.signals.certified && <Badge variant="secondary">Certified</Badge>}
                      {a.signals.legacyOrders > 0 && <Badge variant="secondary">{a.signals.legacyOrders} older order(s)</Badge>}
                    </div>
                  </div>

                  {a.grants.length > 0 && (
                    <ul className="space-y-1 text-sm">
                      {a.grants.slice(0, 6).map((g) => (
                        <li key={g.id} className={cn('flex flex-wrap gap-x-2', g.status !== 'active' && 'text-muted-foreground line-through')}>
                          <span className="text-foreground">{SOURCE_LABEL[g.source] ?? g.source}</span>
                          {g.amount_cents != null && <span>{money(g.amount_cents)}</span>}
                          <span className="text-muted-foreground">{day(g.paid_at)}</span>
                          {g.status !== 'active' && <span>({g.status_reason})</span>}
                          {g.note && <span className="text-muted-foreground">— {g.note}</span>}
                        </li>
                      ))}
                      {a.grants.length > 6 && <li className="text-xs text-muted-foreground">+{a.grants.length - 6} more</li>}
                    </ul>
                  )}

                  {!a.hasAccess && (a.suggestions?.length ?? 0) > 0 && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                      <p className="text-sm text-foreground">Possible payment under another email — confirm before linking:</p>
                      {a.suggestions!.map((sg) => (
                        <div key={sg.id} className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                          <span className="break-all flex-1">{sg.email_normalized} · {money(sg.amount_cents)} · {day(sg.paid_at)}{sg.description ? ` · ${sg.description}` : ''}</span>
                          <Button size="sm" variant="outline" onClick={() => setPending({ kind: 'link', account: a, suggestion: sg })}>Link this payment</Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {!a.roles.includes('admin') && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant={a.hasAccess ? 'outline' : 'default'} onClick={() => setPending({ kind: 'grant', account: a })}>Grant access</Button>
                      {a.hasAccess && <Button size="sm" variant="outline" onClick={() => setPending({ kind: 'revoke', account: a })}>Revoke access</Button>}
                    </div>
                  )}
                </li>
              ))}
              {accounts.length === 0 && <li className="text-center text-muted-foreground py-8">No accounts match.</li>}
            </ul>
          </>
        )}
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) { setPending(null); setReason(''); setConfirmCount(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === 'grant' && 'Grant member access'}
              {pending?.kind === 'revoke' && 'Revoke member access'}
              {pending?.kind === 'link' && 'Link payment to this account'}
              {pending?.kind === 'switch' && (pending.enable ? 'Turn the access check on' : 'Turn the access check off')}
            </DialogTitle>
            <DialogDescription>
              {pending && pending.kind !== 'switch' && <span className="break-all">{pending.account.name || pending.account.email} ({pending.account.email})</span>}
              {pending?.kind === 'switch' && pending.enable && `${s?.membersWithoutAccess ?? 0} account(s) without access will see "access pending" instead of training. Type that number to confirm.`}
              {pending?.kind === 'switch' && !pending.enable && 'Every signed-in account will be able to open training again.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pending?.kind === 'switch' && pending.enable && (
              <div>
                <Label htmlFor="confirm-count">Accounts that will be blocked</Label>
                <Input id="confirm-count" inputMode="numeric" value={confirmCount} onChange={(e) => setConfirmCount(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="access-reason">Reason (saved to the history)</Label>
              <Textarea id="access-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Paid by Zelle on Nov 2, confirmed by Chris" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button
              onClick={() => pending && act.mutate(pending)}
              disabled={!reasonOk || act.isPending || (pending?.kind === 'switch' && pending.enable && Number(confirmCount) !== s?.membersWithoutAccess)}
            >
              {act.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
