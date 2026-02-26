import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PosterTemplate {
  image_url: string | null;
  qr_x: number;
  qr_y: number;
  qr_size: number; // percentage of poster width
}

const DEFAULT: PosterTemplate = { image_url: null, qr_x: 50, qr_y: 50, qr_size: 15 };

export function usePosterTemplate() {
  return useQuery({
    queryKey: ['app-settings', 'poster_template'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'poster_template')
        .maybeSingle();
      if (error) throw error;
      return (data?.value as unknown as PosterTemplate) ?? DEFAULT;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdatePosterTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: PosterTemplate) => {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: template as any })
        .eq('key', 'poster_template');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-settings', 'poster_template'] }),
  });
}
