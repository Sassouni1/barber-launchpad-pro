import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type HairType =
  | 'straight'
  | 'wavy'
  | 'curly'
  | 'coily'
  | 'thinning'
  | 'mixed';

export interface AudienceSettings {
  hair_types: HairType[];
}

const DEFAULT: AudienceSettings = {
  hair_types: ['mixed'],
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
        hair_types: (data.target_ethnicities as HairType[]) ?? DEFAULT.hair_types,
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
            target_ethnicities: settings.hair_types,
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

export const HAIR_TYPE_OPTIONS: { value: HairType; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'wavy', label: 'Wavy' },
  { value: 'curly', label: 'Curly' },
  { value: 'coily', label: 'Coily / Afro' },
  { value: 'thinning', label: 'Thinning / Balding' },
  { value: 'mixed', label: 'Mixed / All types' },
];
