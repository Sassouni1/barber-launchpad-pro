import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type LinkType = 'call' | 'pay' | 'both';

type Info = {
  affiliate?: { code: string; name: string | null };
  callAvailable: boolean;
  checkoutAvailable: boolean;
  setupMessage: string | null;
  error?: string;
};

export default function Refer({ linkType }: { linkType: LinkType }) {
  const { code = '' } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<null | 'call' | 'pay'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    supabase.functions
      .invoke('affiliate-intake', { body: { action: 'info', code } })
      .then(({ data, error }) => {
        if (error || (data as Info)?.error) setError('This referral link is no longer active.');
        else setInfo(data as Info);
      })
      .finally(() => setLoading(false));
  }, [code]);

  const choices = useMemo<Array<'call' | 'pay'>>(
    () => (linkType === 'both' ? ['call', 'pay'] : [linkType]),
    [linkType],
  );

  const submit = async (intent: 'call' | 'pay') => {
    setError(null);
    setNotice(null);
    setSubmitting(intent);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('affiliate-intake', {
        body: { action: 'submit', code, linkType, intent, ...form },
      });
      const payload = data as any;
      if (fnError || payload?.error) {
        setError(payload?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      if (payload.next === 'call') {
        window.location.href = payload.url;
        return;
      }
      if (payload.next === 'setup_incomplete') {
        setNotice(payload.message);
        return;
      }
      if (payload.next === 'checkout') {
        const { data: session, error: checkoutError } = await supabase.functions.invoke('affiliate-checkout', {
          body: { referralRef: payload.referralRef },
        });
        if (checkoutError || (session as any)?.error || !(session as any)?.url) {
          setNotice(
            'Your details are saved and credited to this referral, but online checkout isn\u2019t available right now. The Barber Launch team will reach out to finish your enrollment.',
          );
          return;
        }
        window.location.href = (session as any).url;
      }
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!info?.affiliate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full"><CardContent className="p-6 text-center text-muted-foreground">
          This referral link is no longer active.
        </CardContent></Card>
      </div>
    );
  }

  const canSubmit = form.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold">Barber Launch</h1>
          <p className="text-muted-foreground mt-2">
            {info.affiliate.name ? `${info.affiliate.name} referred you.` : 'You were referred to Barber Launch.'}
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tell us where to reach you</CardTitle>
            <CardDescription>
              We save your details first so your referral is credited properly, whether you book a call or enroll now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ref-name">Full name</Label>
              <Input id="ref-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-email">Email</Label>
              <Input id="ref-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-phone">Phone (optional)</Label>
              <Input id="ref-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
            </div>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {notice && <Alert><AlertDescription>{notice}</AlertDescription></Alert>}

            <div className="flex flex-col gap-2 pt-1">
              {choices.includes('call') && (
                <Button size="lg" disabled={!canSubmit || submitting !== null} onClick={() => submit('call')}>
                  {submitting === 'call' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Book a call with the team
                </Button>
              )}
              {choices.includes('pay') && (
                <Button
                  size="lg"
                  variant={linkType === 'both' ? 'outline' : 'default'}
                  disabled={!canSubmit || submitting !== null}
                  onClick={() => submit('pay')}
                >
                  {submitting === 'pay' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enroll now
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          The person who shared this link may earn a commission if you enroll with Barber Launch. Your price is the same
          either way, and your details are only used by the Barber Launch team.
        </p>
      </div>
    </div>
  );
}

export function ReferThankYou() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardHeader><CardTitle>Thank you</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground space-y-2">
          <p>Your enrollment is being confirmed. The Barber Launch team will email you next steps shortly.</p>
          <p className="text-xs">Payments are confirmed by our payment processor, not by this page.</p>
        </CardContent>
      </Card>
    </div>
  );
}
