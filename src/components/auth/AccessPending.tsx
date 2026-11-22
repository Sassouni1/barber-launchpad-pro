import { useState } from 'react';
import { Loader2, LogOut, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/Logo';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const REASONS: Record<string, string> = {
  email_not_confirmed: 'Please confirm your email first, then check again.',
  rate_limited: 'You checked a few times already. Please try again in an hour.',
  check_unavailable: "We couldn't reach the payment records just now. Please try again in a few minutes.",
  no_email: "This account doesn't have an email we can match to a purchase.",
};

export function AccessPending() {
  const { user, signOut, refreshUserStatus } = useAuth();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const check = async () => {
    setChecking(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('member-access-claim', { body: {} });
      if (error && !data) throw error;
      if (data?.hasAccess) {
        await refreshUserStatus();
        return;
      }
      setResult(REASONS[data?.reason] ?? `We didn't find a completed Barber Launch purchase for ${user?.email ?? 'this email'} yet.`);
    } catch {
      setResult(REASONS.check_unavailable);
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <section className="w-full max-w-md space-y-6 rounded-2xl border border-primary/30 bg-card p-6 sm:p-8 text-center shadow-lg" aria-labelledby="access-pending-title">
        <div className="flex justify-center"><Logo size="lg" /></div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 id="access-pending-title" className="text-2xl font-display font-bold text-foreground">Your member access is pending</h1>
          <p className="text-muted-foreground">
            You're signed in as <span className="font-medium text-foreground break-all">{user?.email}</span>, but we haven't matched a completed Barber Launch purchase to this email yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Training opens as soon as a purchase is matched. If you paid with a different email, contact the Barber Launch team and tell them the email you used at checkout.
          </p>
        </div>
        {result && <p role="status" className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">{result}</p>}
        <div className="flex flex-col gap-3">
          <Button onClick={() => { void check(); }} disabled={checking} size="lg" className="w-full">
            {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Check my purchase
          </Button>
          <Button variant="outline" onClick={() => { void signOut().catch(() => {}); }} className="w-full">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </section>
    </main>
  );
}
