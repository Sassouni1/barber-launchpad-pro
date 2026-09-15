import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PayoutConnectionCard } from '@/components/earnings/PayoutConnectionCard';
import { AffiliateProgramPanel, type PortalData } from '@/components/earnings/AffiliateProgramPanel';

/** Affiliate Program — its own page. Content Rewards lives at /content-rewards. */
export default function Affiliates() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = async (action: 'summary' | 'enroll' = 'summary') => {
    const { data: res, error } = await supabase.functions.invoke('affiliate-portal', { body: { action } });
    if (error) {
      toast({ title: 'Could not load your referrals', description: 'Please try again in a moment.', variant: 'destructive' });
      return;
    }
    setData(res as PortalData);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const join = async () => {
    setJoining(true);
    await load('enroll');
    setJoining(false);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Bonus Earnings</div>
          <h1 className="text-2xl md:text-3xl font-bold">How the affiliate program works</h1>
          <p className="text-muted-foreground mt-1">
            Share Barber Launch. When someone enrolls through your link, you earn $600.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <AffiliateProgramPanel data={data} onEnroll={join} joining={joining} />
            <PayoutConnectionCard compact />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
