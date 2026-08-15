import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AdSocialConnection = {
  connection_status: string;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  instagram_business_account_id: string | null;
};

export function useAdSocialConnection() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ad-social-connection', user?.id],
    enabled: !!user?.id,
    // Onboarding must advance as soon as the member returns from Facebook OAuth,
    // so this state is intentionally short-lived and refetched on focus.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ad_social_connections')
        .select('connection_status, facebook_page_id, facebook_page_name, instagram_business_account_id')
        .eq('customer_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as AdSocialConnection | null) ?? null;
    },
  });
}
