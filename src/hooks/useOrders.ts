import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';

type Order = Tables<'orders'>;

export function useUserOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['orders', 'user', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('order_date', { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!user,
  });
}

export function useAllOrders() {
  return useQuery({
    queryKey: ['orders', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('order_date', { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });
}

export function useUpdateTracking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, trackingNumber }: { orderId: string; trackingNumber: string }) => {
      const hasTracking = !!trackingNumber.trim();
      const { error } = await supabase
        .from('orders')
        .update({
          tracking_number: hasTracking ? trackingNumber : null,
          tracking_url: hasTracking ? `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber.trim()}` : null,
          status: hasTracking ? 'shipped' : 'pending',
        })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useDismissTrackingNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ tracking_seen: true })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUnseenShippedOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['orders', 'unseen-shipped', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'shipped')
        .eq('tracking_seen', false);
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!user,
  });
}
