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

export type AgeRange = '25-35' | '35-45' | '45-55' | '55+' | 'mixed';

export interface AudienceSettings {
  target_ethnicities: Ethnicity[];
  target_age_range: AgeRange;
}

const DEFAULT: AudienceSettings = {
  target_ethnicities: ['mixed'],
  target_age_range: 'mixed',
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
        .select('target_ethnicities, target_age_range')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT;
      return {
        target_ethnicities: (data.target_ethnicities as Ethnicity[]) ?? DEFAULT.target_ethnicities,
        target_age_range: (data.target_age_range as AgeRange) ?? DEFAULT.target_age_range,
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
            target_age_range: settings.target_age_range,
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

export const AGE_RANGE_OPTIONS: { value: AgeRange; label: string }[] = [
  { value: '25-35', label: '25–35' },
  { value: '35-45', label: '35–45' },
  { value: '45-55', label: '45–55' },
  { value: '55+', label: '55+' },
  { value: 'mixed', label: 'Mixed' },
];
