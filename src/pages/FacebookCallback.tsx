import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Facebook, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

type Page = { id: string; name: string };

export default function FacebookCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    if (!code) {
      setError('Missing authorization code from Facebook.');
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke('managed-ad-social', {
        body: { action: 'completeConnection', code, state },
      });
      setLoading(false);
      if (error || data?.error) {
        setError(error?.message || data?.error || 'Could not complete the Facebook connection.');
        return;
      }
      setPages(Array.isArray(data?.pages) ? data.pages : []);
    })();
  }, [params]);

  const selectPage = async (page: Page) => {
    setSaving(page.id);
    const { data, error } = await supabase.functions.invoke('managed-ad-social', {
      body: { action: 'selectPage', facebookPageId: page.id },
    });
    setSaving(null);
    if (error || data?.error) {
      toast.error(error?.message || data?.error || 'Could not save that Page.');
      return;
    }
    setDone(page.name);
    toast.success(`${page.name} is now your campaign Page.`);
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <span className="text-xs tracking-[.18em] text-primary font-semibold">FACEBOOK CONNECTION</span>
          <h1 className="font-display text-2xl font-semibold mt-2">Choose your Facebook Page</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Pick the Page your ads should run from. We never store your Facebook password or access tokens.
          </p>
        </div>

        {loading && (
          <div className="glass-card rounded-xl p-8 flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Finishing your Facebook connection…
          </div>
        )}

        {!loading && error && (
          <div className="glass-card rounded-xl p-6 space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
          </div>
        )}

        {!loading && !error && done && (
          <div className="glass-card rounded-xl p-6 space-y-4">
            <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-primary" /> Connected to <span className="font-medium">{done}</span>.</p>
            <Button onClick={() => navigate('/dashboard')}>Done</Button>
          </div>
        )}

        {!loading && !error && !done && (
          <div className="glass-card rounded-xl divide-y divide-border/60">
            {pages.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No Facebook Pages were returned for your account.</p>
            ) : pages.map((page) => (
              <div key={page.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Facebook className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{page.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{page.id}</p>
                  </div>
                </div>
                <Button size="sm" disabled={saving === page.id} onClick={() => selectPage(page)}>
                  {saving === page.id ? 'Saving…' : 'Use this Page'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
