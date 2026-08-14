import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Instagram, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Connection = {
  connection_status: string;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  instagram_business_account_id: string | null;
};

export function InstagramStatusCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);

  const { data: connection } = useQuery({
    queryKey: ['ad-social-connection', user?.id],
    enabled: !!user?.id,
    staleTime: 300000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ad_social_connections')
        .select('connection_status, facebook_page_id, facebook_page_name, instagram_business_account_id')
        .eq('customer_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Connection | null;
    },
  });

  if (!connection || connection.connection_status !== 'connected' || !connection.facebook_page_id) return null;

  const linked = !!connection.instagram_business_account_id;

  const checkAgain = async () => {
    setChecking(true);
    const { data, error } = await supabase.functions.invoke('managed-ad-social', {
      body: { action: 'syncPage' },
    });
    setChecking(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Could not check Instagram right now.');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['ad-social-connection', user?.id] });
    toast.success(
      data?.page?.instagram_business_account_id
        ? 'Instagram is connected to your Page.'
        : 'Still no Instagram account linked to your Page.',
    );
  };

  const addInstagram = () => {
    window.open(
      `https://www.facebook.com/settings/?tab=linked_profiles&page_id=${connection.facebook_page_id}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  return (
    <div className="glass-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <Instagram className={`w-4 h-4 mt-0.5 ${linked ? 'text-primary' : 'text-muted-foreground'}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{linked ? 'Instagram connected' : 'Instagram not connected'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {linked
              ? 'Instagram placements are available.'
              : 'Add a professional Instagram account to run ads on Instagram.'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!linked && (
          <Button size="sm" onClick={addInstagram}>
            Add Instagram
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={checkAgain} disabled={checking}>
          {checking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Check again
        </Button>
      </div>
    </div>
  );
}
