import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Submission = {
  id: string;
  user_id: string;
  kind: string;
  title: string | null;
  note: string | null;
  status: string;
  reward_cents: number | null;
  review_note: string | null;
  commission_id: string | null;
  consent_use_content: boolean;
  consent_subject_permission: boolean;
  created_at: string;
  member: { full_name: string | null; email: string | null } | null;
  files: Array<{ path: string; url: string | null }>;
};

type AdminData = {
  submissions: Submission[];
  settings: { enabled: boolean; reward_cents: number | null; eligibility: string | null };
  missingContentConfig: string[];
};

const money = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function ContentReviewPanel() {
  const [data, setData] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rewardDollars, setRewardDollars] = useState('');
  const [enabled, setEnabled] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const { data: res, error } = await supabase.functions.invoke('content-rewards', { body });
    const err = (res as { error?: string } | null)?.error;
    if (error || err) {
      toast({ title: 'That did not work', description: err ?? 'Please try again.', variant: 'destructive' });
      return null;
    }
    return res as Record<string, unknown>;
  };

  const load = async () => {
    const res = (await call({ action: 'admin_list' })) as AdminData | null;
    if (res) {
      setData(res);
      setEnabled(Boolean(res.settings?.enabled));
      setRewardDollars(res.settings?.reward_cents ? String(res.settings.reward_cents / 100) : '');
    }
  };

  useEffect(() => { void load(); }, []);

  const saveSettings = async () => {
    setBusy(true);
    const dollars = Number(rewardDollars);
    const res = await call({
      action: 'admin_save_settings',
      settings: {
        enabled,
        reward_cents: Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : null,
      },
    });
    setBusy(false);
    if (res) {
      toast({ title: 'Saved' });
      await load();
    }
  };

  const review = async (id: string, decision: 'approved' | 'rejected') => {
    setBusy(true);
    const res = await call({ action: 'admin_review', submissionId: id, decision, reviewNote: notes[id] || null });
    setBusy(false);
    if (res) {
      toast({
        title: decision === 'approved' ? 'Approved' : 'Rejected',
        description: (res.message as string) ?? (res.awarded ? 'The reward is queued for automatic payout.' : undefined),
      });
      await load();
    }
  };

  if (!data) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const pending = data.submissions.filter((s) => s.status === 'pending');
  const rest = data.submissions.filter((s) => s.status !== 'pending');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Content reward settings</CardTitle>
          <CardDescription>
            Approved content is paid through the same automatic payout pipeline as referral commission. Nothing is
            awarded until an amount is set and rewards are switched on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.missingContentConfig.length > 0 && (
            <Alert>
              <AlertDescription>
                Still needed: {data.missingContentConfig.join('; ')}.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="reward">Reward per approved submission (USD)</Label>
            <Input id="reward" inputMode="decimal" value={rewardDollars} onChange={(e) => setRewardDollars(e.target.value)} placeholder="e.g. 25" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="cr-enabled" />
            <Label htmlFor="cr-enabled">Content rewards are open</Label>
          </div>
          <Button onClick={saveSettings} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Waiting for review ({pending.length})</CardTitle>
          <CardDescription>Reviewing here does not publish anything anywhere.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting.</p>}
          {pending.map((s) => (
            <div key={s.id} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.title || s.kind}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.member?.full_name ?? 'Member'} — {s.member?.email ?? s.user_id} — {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Badge variant="outline">{s.kind}</Badge>
              </div>
              {s.note && <p className="text-sm text-muted-foreground">{s.note}</p>}
              <div className="flex flex-wrap gap-3 text-xs">
                {s.files.map((f) => f.url && (
                  <a key={f.path} href={f.url} target="_blank" rel="noreferrer" className="underline">View file</a>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Permissions confirmed: use content {s.consent_use_content ? 'yes' : 'no'}; people shown {s.consent_subject_permission ? 'yes' : 'no'}
              </div>
              <Textarea
                rows={2}
                placeholder="Note back to the member (optional)"
                value={notes[s.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => review(s.id, 'approved')} disabled={busy}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => review(s.id, 'rejected')} disabled={busy}>Reject</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Already reviewed</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rest.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
          {rest.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
              <div className="min-w-0">
                <div className="truncate">{s.title || s.kind}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {s.member?.email ?? s.user_id} — {new Date(s.created_at).toLocaleDateString()}
                  {s.review_note ? ` — ${s.review_note}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.reward_cents ? <span className="font-medium">{money(s.reward_cents)}</span> : null}
                <Badge variant="outline" className="capitalize">{s.status}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
