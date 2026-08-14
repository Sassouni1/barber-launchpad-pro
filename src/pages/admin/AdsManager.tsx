import { FormEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Megaphone, Pause, Play, Plus, Search, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

type Campaign = {
  id: string;
  customer_id: string;
  name: string;
  status: string;
  daily_budget_cents: number;
  funded_cents: number;
  spent_cents: number;
  meta_ad_account_id: string | null;
  profiles?: { full_name: string | null; business_name: string | null; email: string | null } | null;
};

type AdAccount = {
  meta_ad_account_id: string;
  name: string;
  account_mode: string;
  currency: string;
};

const MIN_DAILY_BUDGET_CENTS = 1000;
const MANAGED_ACCOUNT: AdAccount = {
  meta_ad_account_id: '698039684068863',
  name: 'Barber Launch Managed Account',
  account_mode: 'managed',
  currency: 'USD',
};

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function AdsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    daily_budget: '10',
    meta_ad_account_id: MANAGED_ACCOUNT.meta_ad_account_id,
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['admin-ad-campaigns'],
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ad_campaigns')
        .select('*, profiles!ad_campaigns_customer_id_fkey(full_name,business_name,email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['admin-ad-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,full_name,business_name,email')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: adAccounts = [] } = useQuery({
    queryKey: ['admin-meta-ad-accounts'],
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('meta_ad_accounts')
        .select('meta_ad_account_id,name,account_mode,currency')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data as AdAccount[];
    },
  });

  // Keeps the local preview representative before its migration is applied.
  const availableAccounts = adAccounts.length ? adAccounts : [MANAGED_ACCOUNT];
  const filtered = useMemo(
    () => campaigns.filter((campaign) =>
      `${campaign.name} ${campaign.profiles?.full_name || ''} ${campaign.profiles?.business_name || ''} ${campaign.profiles?.email || ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
    [campaigns, query],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const dailyBudgetCents = Math.round(Number(form.daily_budget || 0) * 100);

    if (!form.customer_id || !form.meta_ad_account_id) {
      toast.error('Choose a customer and managed ad account.');
      return;
    }
    if (dailyBudgetCents < MIN_DAILY_BUDGET_CENTS) {
      toast.error('Daily budget must be at least $10.');
      return;
    }

    setSaving(true);
    const { error } = await (supabase as any).from('ad_campaigns').insert({
      customer_id: form.customer_id,
      meta_ad_account_id: form.meta_ad_account_id,
      name: 'Barber Launch Lead Engine',
      objective: 'lead_generation',
      daily_budget_cents: dailyBudgetCents,
      created_by: user?.id,
      status: 'draft',
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Managed campaign assigned.');
    setOpen(false);
    setForm({ customer_id: '', daily_budget: '10', meta_ad_account_id: MANAGED_ACCOUNT.meta_ad_account_id });
    queryClient.invalidateQueries({ queryKey: ['admin-ad-campaigns'] });
  };

  const updateStatus = async (campaign: Campaign, status: string) => {
    const timestamps = status === 'active'
      ? { launched_at: new Date().toISOString(), paused_at: null }
      : status === 'paused'
        ? { paused_at: new Date().toISOString() }
        : {};
    const { error } = await (supabase as any)
      .from('ad_campaigns')
      .update({ status, ...timestamps })
      .eq('id', campaign.id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ['admin-ad-campaigns'] });
  };

  const active = campaigns.filter((campaign) => campaign.status === 'active').length;
  const funded = campaigns.reduce((total, campaign) => total + campaign.funded_cents - campaign.spent_cents, 0);

  return (
    <DashboardLayout isAdminView>
      <div className="max-w-7xl mx-auto space-y-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[.18em] text-primary font-semibold">ADMIN</p>
            <h1 className="font-display text-3xl font-semibold mt-2">Ads Manager</h1>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Assign campaign</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Assign managed campaign</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Customer</Label>
                  <select required value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Select a Barber Launch member</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.business_name || customer.full_name || customer.email} · {customer.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Daily budget (USD)</Label>
                  <Input required type="number" min="10" step="0.01" value={form.daily_budget} onChange={(event) => setForm({ ...form, daily_budget: event.target.value })} />
                </div>
                <div>
                  <Label>Managed ad account</Label>
                  <select required value={form.meta_ad_account_id} onChange={(event) => setForm({ ...form, meta_ad_account_id: event.target.value })} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {availableAccounts.map((account) => (
                      <option key={account.meta_ad_account_id} value={account.meta_ad_account_id}>
                        {account.name} · {account.meta_ad_account_id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button disabled={saving}>{saving ? 'Assigning…' : 'Assign campaign'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Metric icon={Megaphone} label="Campaigns" value={campaigns.length} />
          <Metric icon={Play} label="Active" value={active} />
          <Metric icon={WalletCards} label="Available media" value={money(funded)} />
        </div>

        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer or campaign" className="max-w-md" />
        </div>

        <div className="rounded-xl border border-border/60 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign / customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Available media</TableHead>
                <TableHead>Meta account</TableHead>
                <TableHead className="text-right">Controls</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Loading campaigns…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No campaigns assigned.</TableCell></TableRow>
              ) : filtered.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div className="font-medium">{campaign.name}</div>
                    <div className="text-xs text-muted-foreground">{campaign.profiles?.business_name || campaign.profiles?.full_name || campaign.profiles?.email}</div>
                  </TableCell>
                  <TableCell><Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className="capitalize">{campaign.status.replace('_', ' ')}</Badge></TableCell>
                  <TableCell>{money(campaign.daily_budget_cents)}/day</TableCell>
                  <TableCell>{money(campaign.funded_cents - campaign.spent_cents)}</TableCell>
                  <TableCell className="font-mono text-xs">{campaign.meta_ad_account_id}</TableCell>
                  <TableCell className="text-right">
                    {campaign.status === 'active' ? (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(campaign, 'paused')}><Pause className="w-3.5 h-3.5 mr-1" />Pause</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(campaign, 'ready')}><Play className="w-3.5 h-3.5 mr-1" />Ready</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Megaphone; label: string; value: string | number }) {
  return <div className="glass-card rounded-xl p-5 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold mt-1">{value}</p></div><Icon className="w-5 h-5 text-primary" /></div>;
}
