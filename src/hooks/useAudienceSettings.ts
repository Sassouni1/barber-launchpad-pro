import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type Ethnicity =
  | 'black'
  | 'white'
  | 'hispanic'
  | 'asian'
  | 'middle_eastern'
  | 'mixed';

export interface AudienceSettings {
  target_ethnicities: Ethnicity[];
}

const DEFAULT: AudienceSettings = {
  target_ethnicities: ['mixed'],
};

export function useAudienceSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['marketing-audience-settings', user?.id],
    enabled: !!user?.id,
    staleTime: 300000,
    queryFn: async (): Promise<AudienceSettings> => {
      const { data, error } = await supabase
        .from('marketing_audience_settings')
        .select('target_ethnicities')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT;
      return {
        target_ethnicities:
          (data.target_ethnicities as Ethnicity[]) ?? DEFAULT.target_ethnicities,
      };
    },
  });
}

export function useUpdateAudienceSettings() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (settings: AudienceSettings) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('marketing_audience_settings')
        .upsert(
          {
            user_id: user.id,
            target_ethnicities: settings.target_ethnicities,
            target_age_range: 'mixed',
          },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-audience-settings', user?.id] });
    },
  });
}

export const ETHNICITY_OPTIONS: { value: Ethnicity; label: string }[] = [
  { value: 'black', label: 'Black / African American' },
  { value: 'white', label: 'White / Caucasian' },
  { value: 'hispanic', label: 'Hispanic / Latino' },
  { value: 'asian', label: 'Asian' },
  { value: 'middle_eastern', label: 'Middle Eastern' },
  { value: 'mixed', label: 'Mixed / Diverse' },
];
