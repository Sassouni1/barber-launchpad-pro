import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';
import { receiptEligibleOrders } from '@/lib/receiptEligibility';

type Order = Tables<'orders'>;
export const TRACKING_ADDED_AT_KEY = 'supplier_tracking_added_at';

export function useUserOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['orders', 'user', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user!.id)
        .neq('status', 'pending_payment')
        .order('order_date', { ascending: false });
      if (error) throw error;
      // Unpaid checkout attempts are audit records, never receipts.
      return receiptEligibleOrders(data as Order[]);
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
        .neq('status', 'pending_payment')
        .order('order_date', { ascending: false });
      if (error) throw error;
      // Manufacturers never see unpaid checkout attempts as production orders.
      return receiptEligibleOrders(data as Order[]);
    },
  });
}

export function useUpdateTracking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, trackingNumber }: { orderId: string; trackingNumber: string }) => {
      const hasTracking = !!trackingNumber.trim();
      const { data: order, error: readError } = await supabase
        .from('orders')
        .select('tracking_number, order_details, updated_at')
        .eq('id', orderId)
        .single();
      if (readError) throw readError;

      const details = order.order_details && typeof order.order_details === 'object' && !Array.isArray(order.order_details)
        ? { ...order.order_details }
        : {};
      if (hasTracking) {
        // Editing a tracking number must not restart the eight-day archive clock.
        details[TRACKING_ADDED_AT_KEY] = order.tracking_number
          ? details[TRACKING_ADDED_AT_KEY] || order.updated_at
          : new Date().toISOString();
      } else {
        delete details[TRACKING_ADDED_AT_KEY];
      }
      const { data: updated, error } = await supabase
        .from('orders')
        .update({
          tracking_number: hasTracking ? trackingNumber : null,
          tracking_url: hasTracking ? `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber.trim()}` : null,
          status: hasTracking ? 'shipped' : 'processing',
          order_details: details,
        })
        .eq('id', orderId)
        .eq('updated_at', order.updated_at)
        .select('id');
      if (error) throw error;
      if (!updated?.length) throw new Error('Order changed while saving. Refresh and try again.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useMarkOrderPlaced() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'processing' })
        .eq('id', orderId)
        .eq('status', 'pending')
        .is('tracking_number', null)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Order is no longer new. Refresh and try again.');
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

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .delete()
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
        .eq('user_id', user!.id)
        .eq('status', 'shipped')
        .eq('tracking_seen', false);
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!user,
  });
}
