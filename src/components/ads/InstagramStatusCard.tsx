import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Instagram, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAdSocialConnection } from '@/hooks/useAdSocialConnection';

export function InstagramStatusCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);

  const { data: connection } = useAdSocialConnection();


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
    // Page-scoped Instagram linking screen (the old /settings?tab=linked_profiles
    // link no longer resolves and lands on a broken Facebook page).
    const url = `https://www.facebook.com/${connection.facebook_page_id}/settings/?tab=instagram_management`;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      try {
        window.top!.location.href = url;
      } catch {
        toast.error('Please allow pop-ups so Facebook can open in a new tab.');
      }
    }
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
