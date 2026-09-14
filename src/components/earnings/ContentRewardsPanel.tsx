import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImagePlus, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { money } from './AffiliateProgramPanel';

const BUCKET = 'content-rewards';
const MAX_FILES = 6;
const MAX_FILE_BYTES = 200 * 1024 * 1024;

const KIND_LABEL: Record<string, string> = {
  before_after: 'Before & after photos',
  install_video: 'Install video',
  other: 'Something else',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting for review',
  approved: 'Approved',
  rejected: 'Not approved',
  withdrawn: 'Withdrawn',
};

type Submission = {
  id: string;
  kind: string;
  title: string | null;
  note: string | null;
  status: string;
  reward_cents: number | null;
  review_note: string | null;
  created_at: string;
  files: Array<{ path: string; url: string | null }>;
};

type SummaryData = {
  settings: { enabled: boolean; rewardCents: number | null; kinds: string[]; ready: boolean };
  submissions: Submission[];
};

export function ContentRewardsPanel({ onChanged }: { onChanged?: () => void }) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [kind, setKind] = useState('before_after');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [consentUse, setConsentUse] = useState(false);
  const [consentSubject, setConsentSubject] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data: res, error } = await supabase.functions.invoke('content-rewards', { body: { action: 'summary' } });
    if (!error) setData(res as SummaryData);
  };

  useEffect(() => { void load(); }, []);

  const pick = (list: FileList | null) => {
    if (!list) return;
    const chosen = Array.from(list).slice(0, MAX_FILES);
    const tooBig = chosen.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      toast({ title: 'That file is too large', description: `${tooBig.name} is over 200MB.`, variant: 'destructive' });
      return;
    }
    setFiles(chosen);
  };

  const submit = async () => {
    if (files.length === 0) {
      toast({ title: 'Add at least one photo or video', variant: 'destructive' });
      return;
    }
    if (!consentUse || !consentSubject) {
      toast({ title: 'Please confirm both permissions first', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('signed out');

      const paths: string[] = [];
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (error) throw error;
        paths.push(path);
      }

      const { data: res, error } = await supabase.functions.invoke('content-rewards', {
        body: {
          action: 'submit',
          kind,
          title: title || null,
          note: note || null,
          filePaths: paths,
          consentUseContent: true,
          consentSubjectPermission: true,
        },
      });
      const err = (res as { error?: string } | null)?.error;
      if (error || err) throw new Error(err ?? 'failed');

      toast({ title: 'Sent for review', description: 'The Barber Launch team will take a look.' });
      setFiles([]); setTitle(''); setNote(''); setConsentUse(false); setConsentSubject(false);
      if (fileInput.current) fileInput.current.value = '';
      await load();
      onChanged?.();
    } catch (e) {
      toast({
        title: 'Could not send that',
        description: e instanceof Error && e.message !== 'failed' ? e.message : 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: string) => {
    await supabase.functions.invoke('content-rewards', { body: { action: 'withdraw', submissionId: id } });
    await load();
    onChanged?.();
  };

  if (!data) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {!data.settings.ready && (
        <Alert>
          <AlertDescription>
            Content rewards aren’t open yet — no amount has been set. You can still send your work in, and the team
            will let you know once rewards are switched on.
          </AlertDescription>
        </Alert>
      )}

      {data.settings.ready && data.settings.rewardCents && (
        <Alert>
          <AlertDescription>
            Approved content earns {money(data.settings.rewardCents)} each, paid the same way as your referral money.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><ImagePlus className="w-4 h-4 text-primary" /> Send in your work</CardTitle>
          <CardDescription>Before-and-after photos, install videos, or anything else you’re proud of.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>What is it?</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(data.settings.kinds ?? Object.keys(KIND_LABEL)).map((k) => (
                  <SelectItem key={k} value={k}>{KIND_LABEL[k] ?? k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cr-title">Title (optional)</Label>
            <Input id="cr-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cr-note">Anything we should know? (optional)</Label>
            <Textarea id="cr-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cr-files">Photos or video (up to {MAX_FILES})</Label>
            <Input
              id="cr-files"
              ref={fileInput}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => pick(e.target.files)}
            />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">{files.length} file{files.length === 1 ? '' : 's'} ready to send.</p>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={consentUse} onCheckedChange={(v) => setConsentUse(v === true)} className="mt-0.5" />
              <span>I give Barber Launch permission to use this content.</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={consentSubject} onCheckedChange={(v) => setConsentSubject(v === true)} className="mt-0.5" />
              <span>Everyone shown in it has given me permission to share it.</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Sending this in is for review only — nothing is posted anywhere as a result.
            </p>
          </div>

          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Send for review
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">What you’ve sent in</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.submissions.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          )}
          {data.submissions.map((s) => (
            <div key={s.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.title || KIND_LABEL[s.kind] || s.kind}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                    {s.review_note ? ` \u2014 ${s.review_note}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.reward_cents ? <span className="text-sm font-medium">{money(s.reward_cents)}</span> : null}
                  <Badge variant="outline">{STATUS_LABEL[s.status] ?? s.status}</Badge>
                </div>
              </div>
              {s.files.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {s.files.map((f) =>
                    f.url ? (
                      <a key={f.path} href={f.url} target="_blank" rel="noreferrer" className="text-xs underline text-muted-foreground shrink-0">
                        View file
                      </a>
                    ) : null,
                  )}
                </div>
              )}
              {s.status === 'pending' && (
                <Button variant="ghost" size="sm" className="mt-2 px-0" onClick={() => withdraw(s.id)}>
                  Withdraw
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
