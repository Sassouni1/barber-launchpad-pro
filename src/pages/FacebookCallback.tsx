import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type Page = { id: string; name: string; instagram_business_account_id: string | null };

export default function FacebookCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) {
      setError('Facebook did not return a connection code.');
      setLoading(false);
      return;
    }
    supabase.functions.invoke('managed-ad-social', { body: { action: 'completeConnection', code, state } })
      .then(({ data, error: invokeError }) => {
        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(data.error);
        setPages(data?.pages ?? []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not connect Facebook.'))
      .finally(() => setLoading(false));
  }, [params]);

  const selectPage = async (page: Page) => {
    setSelecting(page.id);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('managed-ad-social', { body: { action: 'selectPage', pageId: page.id } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      navigate('/ads', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save Facebook Page.');
      setSelecting(null);
    }
  };

  return <main className="min-h-screen bg-background flex items-center justify-center p-6"><div className="w-full max-w-lg rounded-xl border border-border/60 p-6 space-y-5">
    {loading ? <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" />Connecting Facebook…</div> : error ? <><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => navigate('/ads')}>Back to Ads</Button></> : pages.length === 0 ? <><p>No Facebook Pages were returned for this account.</p><Button variant="outline" onClick={() => navigate('/ads')}>Back to Ads</Button></> : <><h1 className="font-display text-2xl font-semibold">Choose your Facebook Page</h1><div className="space-y-2">{pages.map((page) => <Button key={page.id} variant="outline" className="w-full justify-between h-auto py-3" disabled={selecting !== null} onClick={() => selectPage(page)}><span>{page.name}</span>{selecting === page.id && <Loader2 className="w-4 h-4 animate-spin" />}</Button>)}</div></>}
  </div></main>;
}
