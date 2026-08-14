import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Facebook, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Page = { id: string; name: string; instagram_business_account_id?: string | null };

export default function FacebookCallback() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const denied = params.get('error_description') || params.get('error');

    // Scrub the OAuth query string from the URL bar/history immediately.
    window.history.replaceState({}, '', '/integrations/facebook/callback');

    if (denied) {
      setError('Facebook did not complete the authorization. Please try connecting again.');
      setLoading(false);
      return;
    }
    if (!code) {
      setError('This connection link is missing or has already been used. Please start the Facebook connection again from the Ads page.');
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error: fnError } = await supabase.functions.invoke('managed-ad-social', {
        body: { action: 'completeConnection', code, state },
      });
      setLoading(false);
      if (fnError || data?.error) {
        setError(data?.error || fnError?.message || 'Could not complete the Facebook connection.');
        return;
      }
      setPages(Array.isArray(data?.pages) ? data.pages : []);
    })();
  }, []);

  const selectPage = async (page: Page) => {
    setSaving(page.id);
    const { data, error: fnError } = await supabase.functions.invoke('managed-ad-social', {
      body: { action: 'selectPage', facebookPageId: page.id },
    });
    setSaving(null);
    if (fnError || data?.error) {
      toast.error(data?.error || fnError?.message || 'Could not save that Page.');
      return;
    }
    toast.success(`${page.name} is now your campaign Page.`);
    navigate('/ads', { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <span className="text-xs tracking-[.18em] text-primary font-semibold">FACEBOOK CONNECTION</span>
          <h1 className="font-display text-2xl font-semibold mt-2">Choose your Facebook Page</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Pick the Page your ads should run from. We never store your Facebook password, and your access tokens stay on our servers.
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
            <Button variant="outline" onClick={() => navigate('/ads', { replace: true })}>Back to Ads</Button>
          </div>
        )}

        {!loading && !error && (
          <div className="glass-card rounded-xl divide-y divide-border/60">
            {pages.length === 0 ? (
              <div className="p-6 space-y-4">
                <p className="text-sm text-muted-foreground">No Facebook Pages were returned for your account.</p>
                <Button variant="outline" onClick={() => navigate('/ads', { replace: true })}>Back to Ads</Button>
              </div>
            ) : pages.map((page) => (
              <div key={page.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Facebook className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{page.name}</p>
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
