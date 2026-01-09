import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AgreementSetting {
  enabled: boolean;
}

export function useAgreementRequired() {
  return useQuery({
    queryKey: ['app-settings', 'agreement_required'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'agreement_required')
        .maybeSingle();
      
      if (error) throw error;
      const value = data?.value as unknown as AgreementSetting | undefined;
      return value?.enabled ?? true;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useToggleAgreementRequired() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: { enabled } })
        .eq('key', 'agreement_required');
      
      if (error) throw error;
      return enabled;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', 'agreement_required'] });
    },
  });
}
