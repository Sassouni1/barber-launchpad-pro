import { FormEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, Link2, Loader2, Megaphone, Pause, Play, Plus, RefreshCw, Search, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { FacebookConnectButton } from '@/components/ads/FacebookConnectButton';
import { AD_META_STAGE_LABEL, adMetaStage, canCreateOrLink, needsMetaCheck, type AdMetaStage } from '@/lib/adMetaState';

type Campaign = {
  id: string; customer_id: string; name: string; objective: string; status: string;
  daily_budget_cents: number; funded_cents: number; spent_cents: number;
  meta_ad_account_id: string; meta_campaign_id: string | null; landing_page_url: string | null; created_at: string;
  meta_create_status: string | null; meta_create_error: string | null;
  meta_campaign_status: string | null; meta_effective_status: string | null; meta_status_checked_at: string | null;
  last_metrics_sync_at: string | null; last_metrics_sync_error: string | null;
  profiles?: { full_name: string | null; business_name: string | null; email: string | null } | null;
};
type PageAccess = { customer_id: string; connection_status: string | null; facebook_page_name: string | null; facebook_page_id: string | null; page_ad_access_status: string | null; page_ad_access_page_id: string | null };
type LinkPreview = {
  account: { id: string; name: string | null };
  campaign: { id: string; name: string; status: string | null; effective_status: string | null; objective: string | null; created_time: string | null };
  customer: { id: string; name: string | null; email: string | null };
  local: { id: string; name: string };
};
type AgencyStatus = { configured: boolean; reachable?: boolean; account_id: string; message?: string; account?: { name: string | null; account_status: number | null; currency: string | null } };

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const when = (iso: string | null) => iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
const BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID = '2895514127400266';
const SPECIAL_CATEGORIES = [
  { value: 'HOUSING', label: 'Housing' },
  { value: 'EMPLOYMENT', label: 'Employment' },
  { value: 'FINANCIAL_PRODUCTS_SERVICES', label: 'Financial products & services' },
  { value: 'ISSUES_ELECTIONS_POLITICS', label: 'Social issues, elections or politics' },
];
const EMPTY_FORM = { customer_id: '', name: '', objective: 'lead_generation', daily_budget: '10', landing_page_url: '', audience_notes: '' };

const STAGE_VARIANT: Record<AdMetaStage, 'secondary' | 'outline' | 'default' | 'success' | 'destructive'> = {
  local_draft: 'outline', meta_creating: 'secondary', meta_unknown: 'destructive', meta_failed: 'destructive',
  meta_paused: 'secondary', meta_active: 'success', meta_attention: 'destructive', meta_stopped: 'outline', meta_unchecked: 'secondary',
};

async function callMetaAdmin<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('managed-ad-meta-admin', { body });
  if (error) {
    // Edge function errors carry the JSON body in error.context.
    let message = error.message;
    try { const parsed = await (error as { context?: Response }).context?.json(); if (parsed?.error) message = parsed.error; } catch { /* keep default */ }
    throw new Error(message);
  }
  return data as T;
}

export default function AdsManager() {
  const { user } = useAuth(); const queryClient = useQueryClient();
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [createFor, setCreateFor] = useState<Campaign | null>(null);
  const [linkFor, setLinkFor] = useState<Campaign | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-ad-campaigns'] });
  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ['admin-ad-campaigns'], queryFn: async () => { const { data, error } = await (supabase as any).from('ad_campaigns').select('*, profiles!ad_campaigns_customer_id_fkey(full_name,business_name,email)').order('created_at', { ascending: false }); if (error) throw error; return data as Campaign[]; } });
  const { data: customers = [] } = useQuery({ queryKey: ['admin-ad-customers'], queryFn: async () => { const { data, error } = await supabase.from('profiles').select('id,full_name,business_name,email').order('created_at', { ascending: false }); if (error) throw error; return data; } });
  const { data: pageAccess = [] } = useQuery({ queryKey: ['admin-ad-page-access'], queryFn: async () => { const { data, error } = await (supabase as any).from('ad_social_connections').select('customer_id,connection_status,facebook_page_name,facebook_page_id,page_ad_access_status,page_ad_access_page_id'); if (error) throw error; return data as PageAccess[]; } });
  const { data: agency, isLoading: agencyLoading, refetch: refetchAgency } = useQuery({ queryKey: ['admin-meta-agency-status'], staleTime: 300000, queryFn: () => callMetaAdmin<AgencyStatus>({ action: 'status' }) });

  const accessByCustomer = useMemo(() => new Map(pageAccess.map(p => [p.customer_id, p])), [pageAccess]);
  const filtered = useMemo(() => campaigns.filter(c => `${c.name} ${c.profiles?.full_name || ''} ${c.profiles?.business_name || ''} ${c.profiles?.email || ''} ${c.meta_campaign_id || ''}`.toLowerCase().includes(query.toLowerCase())), [campaigns, query]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.customer_id || !form.name) return toast.error('Choose a customer and campaign name.');
    const dailyBudgetCents = draftDailyBudgetCents(form.daily_budget);
    if (dailyBudgetCents === null) return toast.error('Daily budget must be at least $10, or $0 if not set yet.');
    setSaving(true);
    const { error } = await (supabase as any).from('ad_campaigns').insert({
      customer_id: form.customer_id,
      name: form.name,
      objective: form.objective,
      landing_page_url: form.landing_page_url || null,
      audience_notes: form.audience_notes || null,
      meta_ad_account_id: BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID,
      daily_budget_cents: dailyBudgetCents,
      created_by: user?.id,
      status: 'draft',
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Local draft saved. Nothing was created in Meta.');
    setOpen(false); setForm(EMPTY_FORM); refresh();
  };

  // Local registry status only. It never changes anything in Meta.
  const updateLocalStatus = async (campaign: Campaign, status: string) => {
    const timestamps = status === 'paused' ? { paused_at: new Date().toISOString() } : {};
    const { error } = await (supabase as any).from('ad_campaigns').update({ status, ...timestamps }).eq('id', campaign.id);
    if (error) return toast.error(error.message);
    toast.success(`${campaign.name} marked ${status} locally. Nothing changed in Meta.`);
    refresh();
  };

  const runRowAction = async (c: Campaign, action: 'reconcileCreate' | 'refreshMetaStatus' | 'adminSync') => {
    setBusy(`${action}:${c.id}`);
    try {
      if (action === 'adminSync') {
        const { data, error } = await supabase.functions.invoke('managed-ad-reporting', { body: { action: 'adminSync', campaign_id: c.id } });
        if (error) throw new Error(error.message);
        const result = (data?.results ?? [])[0];
        if (data?.status === 'unavailable') toast.error(data.message);
        else if (!result) toast.error('This campaign is not linked to Barber Launch Official, so nothing was synced.');
        else if (result.status === 'ok') toast.success(result.has_delivery ? 'Results synced from Meta.' : 'Synced: Meta has no delivery for the last 30 days.');
        else toast.error(result.reason ?? 'Sync failed.');
      } else {
        const data = await callMetaAdmin<{ message?: string; reconciled?: string; status?: string }>({ action, campaign_id: c.id });
        toast.success(data.message ?? (action === 'refreshMetaStatus' ? `Meta status: ${data.status}` : 'Checked Meta.'));
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Request failed.'); }
    finally { setBusy(null); refresh(); }
  };

  const delivering = campaigns.filter(c => adMetaStage(c) === 'meta_active').length;
  const funded = campaigns.reduce((n, c) => n + c.funded_cents - c.spent_cents, 0);

  return <DashboardLayout isAdminView><div className="max-w-7xl mx-auto space-y-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="text-xs tracking-[.18em] text-primary font-semibold">ADMIN · CUSTOMER-SCOPED</span>
        <h1 className="font-display text-3xl font-semibold mt-2">Ads Manager</h1>
        <p className="text-muted-foreground mt-2">Each campaign belongs to one Barber Launch customer and runs in Barber Launch Official. Members never see or choose the ad account.</p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />New local draft</Button></DialogTrigger>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Create local campaign draft</DialogTitle><DialogDescription>Saving a draft does not create anything in Meta.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Customer</Label><select required value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select a Barber Launch member</option>{customers.map(c => <option key={c.id} value={c.id}>{c.business_name || c.full_name || c.email} · {c.email}</option>)}</select></div>
            <div><Label>Campaign name</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Local hair systems leads" /></div>
            <div><Label>Objective</Label><select value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="lead_generation">Lead generation</option><option value="messages">Messages</option><option value="traffic">Traffic</option><option value="sales">Sales</option></select></div>
            <div><Label>Daily budget (USD, min $10)</Label><Input required type="number" min="0" step="0.01" value={form.daily_budget} onChange={e => setForm({ ...form, daily_budget: e.target.value })} /></div>
            <div><Label>Meta ad account</Label><p className="mt-1 flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">Barber Launch Official · {BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID}</p></div>
            <div className="md:col-span-2"><Label>Landing page URL</Label><Input type="url" value={form.landing_page_url} onChange={e => setForm({ ...form, landing_page_url: e.target.value })} placeholder="https://…" /></div>
            <div className="md:col-span-2"><Label>Audience / campaign notes</Label><Textarea value={form.audience_notes} onChange={e => setForm({ ...form, audience_notes: e.target.value })} placeholder="Location, offer, audience, creative direction…" /></div>
            <div className="md:col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving}>{saving ? 'Saving…' : 'Save local draft'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <div className="glass-card rounded-xl p-5 space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">Barber Launch Official · server connection</p>
          <Button size="sm" variant="ghost" onClick={() => refetchAgency()} aria-label="Recheck Meta connection"><RefreshCw className="w-3.5 h-3.5" /></Button></div>
        {agencyLoading ? <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Checking…</p>
          : !agency ? <p className="text-xs text-destructive">Couldn't check the Meta connection.</p>
          : !agency.configured ? <p className="text-xs text-destructive flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />No server Meta token is set up yet, so campaigns can't be created, linked or synced.</p>
          : agency.reachable ? <p className="text-xs text-muted-foreground flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />Meta confirmed access to {agency.account?.name ?? 'the account'} ({agency.account_id}){agency.account?.currency ? ` · ${agency.account.currency}` : ''}.</p>
          : <p className="text-xs text-destructive flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{agency.message ?? 'Meta refused the server token.'}</p>}
      </div>
      <div className="glass-card rounded-xl p-5 flex flex-wrap items-center justify-between gap-3 min-w-0"><div><p className="text-sm font-medium">Facebook Page identity</p><p className="text-xs text-muted-foreground mt-1">Connect the Facebook Page your campaigns will run from.</p></div><FacebookConnectButton /></div>
    </div>

    <div className="grid gap-4 md:grid-cols-3"><Metric icon={Megaphone} label="Campaigns" value={campaigns.length} /><Metric icon={Play} label="Delivering in Meta" value={delivering} /><Metric icon={WalletCards} label="Unallocated funded media" value={money(funded)} /></div>
    <div className="flex items-center gap-2"><Search className="w-4 h-4 text-muted-foreground" /><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customer, campaign or Meta ID" className="max-w-md" /></div>

    <div className="rounded-xl border border-border/60 overflow-x-auto"><Table>
      <TableHeader><TableRow><TableHead>Campaign / customer</TableHead><TableHead>Meta state</TableHead><TableHead>Page access</TableHead><TableHead>Budget</TableHead><TableHead>Meta account / campaign</TableHead><TableHead className="text-right">Controls</TableHead></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Loading campaigns…</TableCell></TableRow>
        : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No campaigns yet. Save the first customer draft.</TableCell></TableRow>
        : filtered.map(c => {
          const stage = adMetaStage(c);
          const access = accessByCustomer.get(c.customer_id);
          const accessGranted = !!access && access.connection_status === 'connected' && access.page_ad_access_status === 'granted' && access.page_ad_access_page_id === access.facebook_page_id;
          const official = c.meta_ad_account_id === BARBER_LAUNCH_OFFICIAL_AD_ACCOUNT_ID;
          const isBusy = (a: string) => busy === `${a}:${c.id}`;
          return <TableRow key={c.id}>
            <TableCell><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.profiles?.business_name || c.profiles?.full_name || c.profiles?.email} · {c.customer_id.slice(0, 8)}</div></TableCell>
            <TableCell className="min-w-[190px]">
              <Badge variant={STAGE_VARIANT[stage]}>{AD_META_STAGE_LABEL[stage]}</Badge>
              <div className="text-xs text-muted-foreground mt-1 capitalize">Local: {c.status.replace('_', ' ')}</div>
              {c.meta_status_checked_at && <div className="text-xs text-muted-foreground">Checked {when(c.meta_status_checked_at)}</div>}
              {c.meta_create_error && !c.meta_campaign_id && <div className="text-xs text-destructive mt-1 max-w-[240px]">{c.meta_create_error}</div>}
              {c.meta_campaign_id && <div className="text-xs text-muted-foreground mt-1">{c.last_metrics_sync_at ? `Results synced ${when(c.last_metrics_sync_at)}` : 'Results not synced yet'}</div>}
              {c.last_metrics_sync_error && <div className="text-xs text-destructive max-w-[240px]">Last sync: {c.last_metrics_sync_error}</div>}
            </TableCell>
            <TableCell className="text-xs min-w-[150px]">{accessGranted
              ? <span className="text-primary flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Granted · {access?.facebook_page_name}</span>
              : <span className="text-muted-foreground">{!access || access.connection_status !== 'connected' ? 'No Page connected' : `Not granted (${access.page_ad_access_status ?? 'unknown'})`}</span>}</TableCell>
            <TableCell className="text-sm whitespace-nowrap">{money(c.daily_budget_cents)}/day<div className="text-xs text-muted-foreground">{money(c.funded_cents - c.spent_cents)} funded left</div></TableCell>
            <TableCell className="font-mono text-xs"><div className={official ? '' : 'text-destructive'}>{c.meta_ad_account_id}{official ? '' : ' (not Official)'}</div><div className="text-muted-foreground">{c.meta_campaign_id ?? '—'}</div></TableCell>
            <TableCell className="text-right"><div className="flex flex-wrap justify-end gap-1">
              {official && canCreateOrLink(c) && c.status !== 'archived' && <>
                <Button size="sm" onClick={() => setCreateFor(c)} disabled={!agency?.reachable}>Create PAUSED in Meta</Button>
                <Button size="sm" variant="outline" onClick={() => setLinkFor(c)} disabled={!agency?.reachable}><Link2 className="w-3.5 h-3.5 mr-1" />Link existing</Button>
              </>}
              {needsMetaCheck(c) && <Button size="sm" variant="outline" onClick={() => runRowAction(c, 'reconcileCreate')} disabled={!!busy}>{isBusy('reconcileCreate') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Check Meta'}</Button>}
              {c.meta_campaign_id && <>
                <Button size="sm" variant="outline" onClick={() => runRowAction(c, 'refreshMetaStatus')} disabled={!!busy}>{isBusy('refreshMetaStatus') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh status'}</Button>
                <Button size="sm" variant="outline" onClick={() => runRowAction(c, 'adminSync')} disabled={!!busy}>{isBusy('adminSync') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sync results'}</Button>
              </>}
              {c.status === 'active'
                ? <Button size="sm" variant="ghost" onClick={() => updateLocalStatus(c, 'paused')} title="Local registry only. Does not change Meta."><Pause className="w-3.5 h-3.5 mr-1" />Local pause</Button>
                : c.status !== 'ready' && c.status !== 'archived' && <Button size="sm" variant="ghost" onClick={() => updateLocalStatus(c, 'ready')} title="Local registry only. Does not create or start anything in Meta.">Mark ready (local)</Button>}
            </div></TableCell>
          </TableRow>;
        })}</TableBody>
    </Table></div>
    <p className="text-xs text-muted-foreground">Create PAUSED in Meta makes only a paused campaign in Barber Launch Official: no ad sets, ads, budget or spend. Activation and spending stay outside this screen. "Mark ready (local)" only changes this registry.</p>

    {createFor && <CreatePausedDialog campaign={createFor} pageAccess={accessByCustomer.get(createFor.customer_id)} onClose={() => { setCreateFor(null); refresh(); }} />}
    {linkFor && <LinkExistingDialog campaign={linkFor} onClose={() => { setLinkFor(null); refresh(); }} />}
  </div></DashboardLayout>;
}

function CreatePausedDialog({ campaign, pageAccess, onClose }: { campaign: Campaign; pageAccess?: PageAccess; onClose: () => void }) {
  const [declaration, setDeclaration] = useState<'' | 'none' | 'categories'>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const ready = declaration === 'none' || (declaration === 'categories' && categories.length > 0);
  const create = async () => {
    setSending(true);
    try {
      const data = await callMetaAdmin<{ meta_campaign_id?: string; already?: boolean; message?: string; reconciled?: string }>({
        action: 'createPausedCampaign', campaign_id: campaign.id,
        special_ads: declaration === 'none' ? { declaration: 'none' } : { declaration: 'categories', categories },
      });
      if (data.meta_campaign_id) toast.success(data.already ? `Already linked to Meta campaign ${data.meta_campaign_id}.` : `Created PAUSED Meta campaign ${data.meta_campaign_id}.`);
      else toast.message(data.message ?? 'Checked Meta.');
      onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Create failed.'); setSending(false); }
  };
  return <Dialog open onOpenChange={o => !o && !sending && onClose()}><DialogContent className="max-w-lg">
    <DialogHeader><DialogTitle>Create PAUSED campaign in Meta</DialogTitle><DialogDescription>Creates only a paused campaign. No ad set, ad, budget or spend.</DialogDescription></DialogHeader>
    <dl className="grid grid-cols-[110px_1fr] gap-y-1 text-sm">
      <dt className="text-muted-foreground">Campaign</dt><dd>{campaign.name}</dd>
      <dt className="text-muted-foreground">Customer</dt><dd>{campaign.profiles?.business_name || campaign.profiles?.full_name} · {campaign.profiles?.email}</dd>
      <dt className="text-muted-foreground">Ad account</dt><dd className="font-mono text-xs">Barber Launch Official · {campaign.meta_ad_account_id}</dd>
      <dt className="text-muted-foreground">Page</dt><dd>{pageAccess?.facebook_page_name ?? 'None connected'} · access {pageAccess?.page_ad_access_status ?? 'unknown'}</dd>
    </dl>
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Does this campaign advertise in a Meta special ad category?</legend>
      <label className="flex items-center gap-2 text-sm"><input type="radio" name="decl" checked={declaration === 'none'} onChange={() => setDeclaration('none')} />No: none of housing, employment, financial products, or social issues/elections/politics</label>
      <label className="flex items-center gap-2 text-sm"><input type="radio" name="decl" checked={declaration === 'categories'} onChange={() => setDeclaration('categories')} />Yes, it's in a special category</label>
      {declaration === 'categories' && <div className="pl-6 space-y-1">{SPECIAL_CATEGORIES.map(cat => <label key={cat.value} className="flex items-center gap-2 text-sm"><Checkbox checked={categories.includes(cat.value)} onCheckedChange={v => setCategories(v ? [...categories, cat.value] : categories.filter(x => x !== cat.value))} />{cat.label}</label>)}</div>}
    </fieldset>
    <p className="text-xs text-muted-foreground">The server re-checks with Meta that Barber Launch has advertising access to this customer's Page before creating anything.</p>
    <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button><Button onClick={create} disabled={!ready || sending}>{sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : 'Create PAUSED campaign'}</Button></div>
  </DialogContent></Dialog>;
}

function LinkExistingDialog({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const [metaId, setMetaId] = useState('');
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doPreview = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null); setPreview(null);
    try { const data = await callMetaAdmin<{ preview: LinkPreview }>({ action: 'previewLink', campaign_id: campaign.id, meta_campaign_id: metaId.trim() }); setPreview(data.preview); }
    catch (err) { setError(err instanceof Error ? err.message : 'Preview failed.'); }
    finally { setLoading(false); }
  };
  const confirm = async () => {
    if (!preview) return;
    setLoading(true); setError(null);
    try { await callMetaAdmin({ action: 'confirmLink', campaign_id: campaign.id, meta_campaign_id: preview.campaign.id, customer_id: preview.customer.id }); toast.success(`Linked Meta campaign ${preview.campaign.id} to ${preview.customer.name ?? preview.customer.email}.`); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Link failed.'); setLoading(false); }
  };
  return <Dialog open onOpenChange={o => !o && !loading && onClose()}><DialogContent className="max-w-lg">
    <DialogHeader><DialogTitle>Link an existing PAUSED Meta campaign</DialogTitle><DialogDescription>Meta must confirm the campaign is in Barber Launch Official and PAUSED. Matching by name is not used.</DialogDescription></DialogHeader>
    <form onSubmit={doPreview} className="flex gap-2"><Input inputMode="numeric" value={metaId} onChange={e => { setMetaId(e.target.value); setPreview(null); }} placeholder="Meta campaign ID" aria-label="Meta campaign ID" /><Button type="submit" variant="outline" disabled={loading || !/^\d{5,25}$/.test(metaId.trim())}>{loading && !preview ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}</Button></form>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    {preview && <div className="rounded-lg border border-border/60 p-3 space-y-1 text-sm">
      <p><span className="text-muted-foreground">Account:</span> {preview.account.name ?? 'Barber Launch Official'} · <span className="font-mono text-xs">{preview.account.id}</span></p>
      <p><span className="text-muted-foreground">Meta campaign:</span> {preview.campaign.name} · <span className="font-mono text-xs">{preview.campaign.id}</span></p>
      <p><span className="text-muted-foreground">Status:</span> {preview.campaign.status}{preview.campaign.effective_status && preview.campaign.effective_status !== preview.campaign.status ? ` (${preview.campaign.effective_status})` : ''}</p>
      <p><span className="text-muted-foreground">Customer:</span> {preview.customer.name} · {preview.customer.email}</p>
      <p><span className="text-muted-foreground">Local campaign:</span> {preview.local.name}</p>
    </div>}
    <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button><Button onClick={confirm} disabled={!preview || loading}>{loading && preview ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Link to this customer'}</Button></div>
  </DialogContent></Dialog>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Megaphone; label: string; value: string | number }) { return <div className="glass-card rounded-xl p-5 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold mt-1">{value}</p></div><Icon className="w-5 h-5 text-primary" /></div>; }
