import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface BusinessCard {
  id: string;
  user_id: string;
  business_name: string;
  title: string;
  first_name: string;
  last_name: string;
  booking_url: string;
  gallery_url: string;
  instagram_handle: string;
  website_url: string;
  phone: string;
  email: string;
  logo_url: string;
  hero_image_url: string;
  short_code: string;
  created_at: string;
  updated_at: string;
}

function generateShortCode(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export function useBusinessCard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['business-card', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('business_cards')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as BusinessCard | null;
    },
    enabled: !!user,
  });
}

export function useBusinessCardByCode(shortCode: string | undefined) {
  return useQuery({
    queryKey: ['business-card-public', shortCode],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('business_cards')
        .select('*')
        .eq('short_code', shortCode)
        .maybeSingle();
      if (error) throw error;
      return data as BusinessCard | null;
    },
    enabled: !!shortCode,
  });
}

export function useSaveBusinessCard() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (card: Partial<BusinessCard> & { id?: string }) => {
      if (!user) throw new Error('Not authenticated');

      if (card.id) {
        const { id, user_id, created_at, updated_at, short_code, ...updates } = card as any;
        const { error } = await (supabase as any)
          .from('business_cards')
          .update(updates)
          .eq('id', id);
        if (error) throw error;
      } else {
        const short_code = generateShortCode();
        const { error } = await (supabase as any)
          .from('business_cards')
          .insert({ ...card, user_id: user.id, short_code });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-card'] }),
  });
}

export function useUploadCardAsset() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'logo' | 'hero' }) => {
      if (!user) throw new Error('Not authenticated');
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${type}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('business-card-assets')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage
        .from('business-card-assets')
        .getPublicUrl(path);
      return data.publicUrl;
    },
  });
}
