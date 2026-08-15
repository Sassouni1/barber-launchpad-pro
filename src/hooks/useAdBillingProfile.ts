import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AdBillingProfile = {
  default_payment_method_id: string | null;
};

/**
 * A saved default payment method is the durable "billing setup complete" signal.
 * An in-progress checkout or a $0 balance does NOT count.
 */
export function useAdBillingProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ad-billing-profile', user?.id],
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ad_billing_profiles')
        .select('default_payment_method_id')
        .eq('customer_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as AdBillingProfile | null) ?? null;
    },
  });
}
