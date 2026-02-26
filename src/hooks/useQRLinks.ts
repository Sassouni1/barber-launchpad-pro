import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface QRLink {
  id: string;
  user_id: string;
  short_code: string;
  destination_url: string;
  label: string;
  scan_count: number;
  created_at: string;
  updated_at: string;
}

function generateShortCode(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function useQRLinks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['qr-links', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qr_links')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as QRLink[];
    },
    enabled: !!user,
  });
}

export function useCreateQRLink() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ label, destination_url }: { label: string; destination_url: string }) => {
      if (!user) throw new Error('Not authenticated');
      const short_code = generateShortCode();
      const { data, error } = await supabase
        .from('qr_links')
        .insert({ user_id: user.id, short_code, destination_url, label })
        .select()
        .single();
      if (error) throw error;
      return data as QRLink;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qr-links'] }),
  });
}

export function useUpdateQRLink() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, destination_url, label }: { id: string; destination_url?: string; label?: string }) => {
      const updates: Record<string, string> = {};
      if (destination_url !== undefined) updates.destination_url = destination_url;
      if (label !== undefined) updates.label = label;
      const { error } = await supabase.from('qr_links').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qr-links'] }),
  });
}

export function useDeleteQRLink() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('qr_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qr-links'] }),
  });
}
