import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clapperboard,
  Facebook,
  Globe,
  Image as ImageIcon,
  Instagram,
  Loader2,
  MessageSquareMore,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';

type Campaign = {
  id: string;
  name: string;
  status: string;
  desired_status: 'active' | 'paused';
  daily_budget_cents: number;
  funded_cents: number;
  spent_cents: number;
  currency: string;
};

type DashboardData = {
  campaigns: Campaign[];
  billing: { autopay_enabled: boolean } | null;
  transactions: unknown[];
};

type SocialConnection = {
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  instagram_business_account_id: string | null;
  connection_status: string;
};

type AutomationState = 'ready' | 'connection' | 'setup';

const money = (cents: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(cents / 100);

const invoke = async (action: string, payload: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke('managed-ad-campaigns', {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export default function Ads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [campaignBuilderOpen, setCampaignBuilderOpen] = useState(false);
  const [dailyBudget, setDailyBudget] = useState('10');
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [syncingInstagram, setSyncingInstagram] = useState(false);
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['member-managed-ads'],
    queryFn: () => invoke('getDashboard'),
    retry: false,
  });
  const { data: socialConnection } = useQuery<SocialConnection | null>({
    queryKey: ['member-ad-social-connection'],
    queryFn: async () => {
      const { data: connection, error } = await supabase
        .from('ad_social_connections')
        .select('facebook_page_id,facebook_page_name,instagram_business_account_id,connection_status')
        .maybeSingle();
      if (error) throw error;
      return connection;
    },
    retry: false,
  });

  const campaigns = data?.campaigns ?? [];
  const isFacebookConnected = socialConnection?.connection_status === 'connected';
  const isInstagramConnected = Boolean(socialConnection?.instagram_business_account_id);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['member-managed-ads'] });

  const saveBudget = async (campaign: Campaign, budget: string) => {
    setBusyId(`budget-${campaign.id}`);
    try {
      await invoke('setBudget', { campaignId: campaign.id, dailyBudget: Number(budget) });
      await refresh();
      toast.success('Daily budget updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update budget');
    } finally {
      setBusyId(null);
    }
  };

  const setEnabled = async (campaign: Campaign, enabled: boolean) => {
    setBusyId(`status-${campaign.id}`);
    try {
      const result = await invoke('setDesiredStatus', {
        campaignId: campaign.id,
        desiredStatus: enabled ? 'active' : 'paused',
      });
      if (result.requiresFunding) toast.error('Add funds before turning this campaign on.');
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update campaign');
    } finally {
      setBusyId(null);
    }
  };

  const connectFacebook = async () => {
    try {
      const { data: response, error } = await supabase.functions.invoke('managed-ad-social', {
        body: { action: 'getConnectUrl' },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      window.location.assign(response.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start Facebook connection');
    }
  };

  const addInstagram = () => {
    if (!socialConnection?.facebook_page_id) {
      toast.error('Connect a Facebook Page first.');
      return;
    }
    window.open(`https://www.facebook.com/${socialConnection.facebook_page_id}/settings?tab=linked_accounts`, '_blank', 'noopener,noreferrer');
  };

  const syncInstagram = async () => {
    setSyncingInstagram(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('managed-ad-social', {
        body: { action: 'syncPage' },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      await queryClient.invalidateQueries({ queryKey: ['member-ad-social-connection'] });
      toast.success(response?.page?.instagram_business_account_id ? 'Instagram connected.' : 'Instagram is not linked to this Facebook Page yet.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not refresh Instagram status');
    } finally {
      setSyncingInstagram(false);
    }
  };

  const createCampaign = async () => {
    const budget = Number(dailyBudget);
    if (!Number.isFinite(budget) || budget < 10) {
      toast.error('Start with at least $10 per day.');
      return;
    }

    setCreatingCampaign(true);
    try {
      await invoke('createCampaign', {
        dailyBudget: budget,
        creationKey: crypto.randomUUID(),
      });
      await refresh();
      setCampaignBuilderOpen(false);
      toast.success('Your campaign was prepared. Connect Facebook and fund it when you are ready to launch.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not prepare campaign');
    } finally {
      setCreatingCampaign(false);
    }
  };

  const automations: Array<{
    title: string;
    description: string;
    state: AutomationState;
    icon: typeof Sparkles;
    action: string;
    onClick: () => void;
  }> = [
    {
      title: 'Offer & conversion plan',
      description: 'Clarify the best local offer, proof, price framing, landing-page promise, and call to action before traffic ever arrives.',
      state: 'setup',
      icon: Target,
      action: 'Build my offer',
      onClick: () => navigate('/aion', { state: { initialMessage: 'Help me create a high-converting offer and landing-page plan for my barber and hair-system business.' } }),
    },
    {
      title: 'Brand & content studio',
      description: 'Turn your website, offer, and audience into on-brand posts, captions, and image variations.',
      state: 'ready',
      icon: ImageIcon,
      action: 'Create content',
      onClick: () => navigate('/marketing'),
    },
    {
      title: 'Social calendar & publishing',
      description: 'Turn the content plan into the right cadence, formats, captions, approval queue, and publishing schedule for each channel.',
      state: 'setup',
      icon: Megaphone,
      action: 'Plan my calendar',
      onClick: () => navigate('/aion', { state: { initialMessage: 'Help me create a weekly social media calendar that turns barber and hair-system content into booked consultations.' } }),
    },
    {
      title: 'Short-form video engine',
      description: 'Build hooks, scenes, voiceover, captions, and export-ready Reels from real client proof and shop footage.',
      state: 'setup',
      icon: Clapperboard,
      action: 'Configure video',
      onClick: () => navigate('/aion', { state: { initialMessage: 'Help me plan a short-form video using my client proof and shop footage.' } }),
    },
    {
      title: 'Lead campaign builder',
      description: 'Prepare a Barber Launch campaign, set a responsible daily budget, and control launch status in one place.',
      state: isFacebookConnected ? 'ready' : 'connection',
      icon: Target,
      action: isFacebookConnected ? 'Prepare campaign' : 'Connect Facebook',
      onClick: isFacebookConnected ? () => setCampaignBuilderOpen(true) : connectFacebook,
    },
    {
      title: 'Lead follow-up sequences',
      description: 'Route each inquiry into fast SMS, missed-call, booking, no-show, and nurture follow-up—without leads slipping through.',
      state: 'setup',
      icon: MessageSquareMore,
      action: 'Design follow-up',
      onClick: () => navigate('/aion', { state: { initialMessage: 'Help me design a lead follow-up sequence for my barber and hair-system business.' } }),
    },
    {
      title: 'Appointment recovery',
      description: 'Detect unbooked, no-show, and stalled leads, then create the right next message and recovery task.',
      state: 'setup',
      icon: CalendarClock,
      action: 'Plan recovery',
      onClick: () => navigate('/aion', { state: { initialMessage: 'Help me build an appointment recovery workflow for leads who did not book or did not show.' } }),
    },
    {
      title: 'Reviews, referrals & reactivation',
      description: 'Ask happy clients at the right moment, make referrals easy, and bring past clients back with offers that feel personal.',
      state: 'setup',
      icon: Star,
      action: 'Build retention',
      onClick: () => navigate('/aion', { state: { initialMessage: 'Help me build review, referral, and client reactivation workflows for my barber and hair-system business.' } }),
    },
    {
      title: 'Local search & reputation',
      description: 'Keep Google Business, location pages, before-and-after proof, and local trust signals working together so nearby clients can find you.',
      state: 'setup',
      icon: Globe,
      action: 'Plan local growth',
      onClick: () => navigate('/aion', { state: { initialMessage: 'Help me create a local SEO and Google Business growth plan for my barber and hair-system business.' } }),
    },
    {
      title: 'Revenue proof & optimization',
      description: 'Tie ad spend to qualified leads, appointments, sales, and the creatives that actually create revenue.',
      state: campaigns.length > 0 ? 'ready' : 'setup',
      icon: BarChart3,
      action: campaigns.length > 0 ? 'Review campaigns' : 'Set up campaign',
      onClick: campaigns.length > 0 ? () => document.getElementById('campaign-control')?.scrollIntoView({ behavior: 'smooth' }) : () => setCampaignBuilderOpen(true),
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card/80 to-background px-6 py-8 md:px-9 md:py-10">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0 max-w-3xl">
              <Badge className="mb-4 gap-1.5 bg-primary/20 text-primary hover:bg-primary/20"><Bot className="h-3.5 w-3.5" /> AION Marketing HQ</Badge>
              <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Your marketing should make the next client happen.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                AION turns your real offer, proof, content, ads, and follow-up into one operating system—so you can create demand and turn it into booked appointments.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
              <Button className="gap-2" onClick={() => navigate('/marketing')}><Sparkles className="h-4 w-4" /> Create this week&apos;s content</Button>
              <Button variant="outline" className="gap-2" onClick={() => setCampaignBuilderOpen(true)}><Target className="h-4 w-4" /> Prepare a lead campaign</Button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <SignalCard icon={Facebook} label="Distribution" value={isFacebookConnected ? socialConnection?.facebook_page_name || 'Facebook connected' : 'Connect Facebook'} detail={isFacebookConnected ? 'AION can use your Page for campaign delivery.' : 'Required before campaigns can be launched.'} tone={isFacebookConnected ? 'ready' : 'attention'} />
          <SignalCard icon={CircleDollarSign} label="Campaigns" value={isLoading ? 'Loading…' : `${campaigns.length} prepared`} detail={campaigns.length ? 'Budgets and launch status are controlled below.' : 'Prepare the first campaign when your offer is ready.'} tone={campaigns.length ? 'ready' : 'neutral'} />
          <SignalCard icon={UsersRound} label="Growth loop" value="Content → lead → booking" detail="The systems AION needs to keep every paid lead moving." tone="neutral" />
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">THE COMPLETE KIT</p>
              <h2 className="font-display text-3xl font-semibold">Everything AION needs to automate growth</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">A strong marketing tool does not stop at a pretty post. It plans, produces, distributes, responds, books, and learns from revenue.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {automations.map((automation) => <AutomationCard key={automation.title} {...automation} />)}
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/50 p-5 md:p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="h-4 w-4" /> AION&apos;s launch rule</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">Never launch a campaign into a broken follow-up system.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Before spend goes live, AION needs a clear offer, approved creative, a conversion destination, fast lead response, booking availability, and a way to prove the result. This keeps barbers from paying for leads that nobody works.</p>
            </div>
            <Button variant="outline" className="shrink-0 gap-2" onClick={() => navigate('/aion', { state: { initialMessage: 'Audit my marketing system before I run paid ads. Tell me what is missing from offer through booking follow-up.' } })}>
              Run a marketing audit <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section id="campaign-control" className="scroll-mt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">PAID ACQUISITION</p>
              <h2 className="font-display text-3xl font-semibold">Campaign control</h2>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => refresh()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
              <Button size="sm" className="gap-2" onClick={() => setCampaignBuilderOpen(true)}><Target className="h-4 w-4" /> Prepare campaign</Button>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><div className={`rounded-xl p-2.5 ${isFacebookConnected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-primary/15 text-primary'}`}><Facebook className="h-5 w-5" /></div><div><p className="font-medium">{isFacebookConnected ? socialConnection?.facebook_page_name || 'Facebook Page connected' : 'Connect your Facebook Page'}</p><p className="text-sm text-muted-foreground">{isFacebookConnected ? 'Ready for campaign delivery and Page-level visibility.' : 'This is the first distribution connection AION needs.'}</p></div></div>
            <Button variant="outline" onClick={connectFacebook}>{isFacebookConnected ? 'Reconnect' : 'Connect Facebook'}</Button>
          </div>

          {isFacebookConnected && <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><div className={`rounded-xl p-2.5 ${isInstagramConnected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}><Instagram className="h-5 w-5" /></div><div><p className="font-medium">{isInstagramConnected ? 'Instagram connected' : 'Instagram not connected'}</p><p className="text-sm text-muted-foreground">{isInstagramConnected ? 'Instagram placements are available for this Page.' : 'Add a professional Instagram account to run ads on Instagram.'}</p></div></div>
            <div className="flex gap-2"><Button variant="outline" onClick={syncInstagram} disabled={syncingInstagram}>{syncingInstagram && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check again</Button>{!isInstagramConnected && <Button onClick={addInstagram}>Add Instagram</Button>}</div>
          </div>}

          {isLoading ? <div className="rounded-2xl border border-border/60 p-8 text-muted-foreground">Loading campaigns…</div> : campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-8 text-center">
              <Target className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 font-display text-xl font-semibold">No campaign prepared yet</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Start with one focused offer and a $10/day minimum. AION will keep the campaign paused until it has available media funds.</p>
              <Button className="mt-5 gap-2" onClick={() => setCampaignBuilderOpen(true)}><MousePointerClick className="h-4 w-4" /> Prepare the first campaign</Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} busyId={busyId} saveBudget={saveBudget} setEnabled={setEnabled} />)}
            </div>
          )}
        </section>
      </div>

      <Dialog open={campaignBuilderOpen} onOpenChange={setCampaignBuilderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Prepare a lead campaign</DialogTitle>
            <DialogDescription>This prepares your Barber Launch campaign in a paused state. It does not charge you or turn ads on.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> What AION will control</div>
              Budget, launch/pause status, and the handoff to your managed campaign. Connect Facebook before launch and make sure your lead follow-up is ready.
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-budget">Daily media budget</Label>
              <div className="relative"><span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span><Input id="campaign-budget" className="pl-7" min="10" step="1" type="number" value={dailyBudget} onChange={(event) => setDailyBudget(event.target.value)} /></div>
              <p className="text-xs text-muted-foreground">Minimum $10/day. You can change the budget before launch.</p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCampaignBuilderOpen(false)}>Cancel</Button><Button onClick={createCampaign} disabled={creatingCampaign}>{creatingCampaign && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Prepare campaign</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function SignalCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Target; label: string; value: string; detail: string; tone: 'ready' | 'attention' | 'neutral' }) {
  const toneClasses = tone === 'ready' ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400' : tone === 'attention' ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border/60 bg-card/40 text-muted-foreground';
  return <div className={`rounded-2xl border p-4 ${toneClasses}`}><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em]"><Icon className="h-4 w-4" /> {label}</div><p className="mt-3 text-lg font-semibold text-foreground">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>;
}

function AutomationCard({ title, description, state, icon: Icon, action, onClick }: { title: string; description: string; state: AutomationState; icon: typeof Sparkles; action: string; onClick: () => void }) {
  const status = state === 'ready' ? { label: 'Ready now', className: 'bg-emerald-500/15 text-emerald-400' } : state === 'connection' ? { label: 'Connection needed', className: 'bg-primary/15 text-primary' } : { label: 'Needs setup', className: 'bg-muted text-muted-foreground' };
  return <article className="group flex min-h-64 flex-col rounded-2xl border border-border/60 bg-card/55 p-5 transition-colors hover:border-primary/35"><div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div><Badge variant="secondary" className={status.className}>{status.label}</Badge></div><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{description}</p><Button variant="ghost" className="mt-5 w-full justify-between border border-border/50 hover:border-primary/30 hover:bg-primary/5" onClick={onClick}>{action} <ArrowRight className="h-4 w-4" /></Button></article>;
}

function CampaignCard({ campaign, busyId, saveBudget, setEnabled }: { campaign: Campaign; busyId: string | null; saveBudget: (campaign: Campaign, budget: string) => Promise<void>; setEnabled: (campaign: Campaign, enabled: boolean) => Promise<void> }) {
  const [budget, setBudget] = useState(String(campaign.daily_budget_cents / 100));
  const available = campaign.funded_cents - campaign.spent_cents;
  const canActivate = available >= campaign.daily_budget_cents;
  const isActive = campaign.desired_status === 'active';
  return <div className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-semibold">{campaign.name}</h3><Badge variant={isActive ? 'default' : 'secondary'} className="capitalize">{campaign.status.replaceAll('_', ' ')}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{isActive ? 'AION has requested this campaign be live.' : 'Paused until you are ready to launch.'}</p></div><Switch checked={isActive} disabled={busyId === `status-${campaign.id}` || (!isActive && !canActivate)} onCheckedChange={(checked) => setEnabled(campaign, checked)} /></div><div><Label>Daily media budget</Label><div className="mt-1 flex gap-2"><Input type="number" min="10" step="1" value={budget} onChange={(event) => setBudget(event.target.value)} /><Button variant="outline" disabled={busyId === `budget-${campaign.id}`} onClick={() => saveBudget(campaign, budget)}>Save</Button></div></div><div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3 text-sm"><div><p className="text-muted-foreground">Media balance</p><p className="mt-1 font-semibold">{money(available)}</p></div><div><p className="text-muted-foreground">Launch readiness</p><p className="mt-1 font-semibold">{canActivate ? 'Funded' : 'Funding needed'}</p></div></div><Button className="w-full" variant="outline" disabled><WalletCards className="mr-2 h-4 w-4" /> Payments are not enabled for this test.</Button></div>;
}
