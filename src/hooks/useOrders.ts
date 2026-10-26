import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';
import { receiptEligibleOrders } from '@/lib/receiptEligibility';

type Order = Tables<'orders'>;
export const TRACKING_ADDED_AT_KEY = 'supplier_tracking_added_at';
export const TRACKING_CARRIER_KEY = 'supplier_tracking_carrier';
export const REOPEN_HISTORY_KEY = 'supplier_reopen_history';
export type TrackingCarrier = 'DHL' | 'FedEx' | 'Other';

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
    mutationFn: async ({ orderId, trackingNumber, carrier }: { orderId: string; trackingNumber: string; carrier: TrackingCarrier }) => {
      const number = trackingNumber.trim();
      if (!number) throw new Error('Enter a tracking number.');
      const { data: order, error: readError } = await supabase
        .from('orders')
        .select('tracking_number, order_details, updated_at')
        .eq('id', orderId)
        .single();
      if (readError) throw readError;

      const details = order.order_details && typeof order.order_details === 'object' && !Array.isArray(order.order_details)
        ? { ...order.order_details }
        : {};
      // Editing a tracking number must not restart the eight-day archive clock.
      details[TRACKING_ADDED_AT_KEY] = order.tracking_number
        ? details[TRACKING_ADDED_AT_KEY] || order.updated_at
        : new Date().toISOString();
      details[TRACKING_CARRIER_KEY] = carrier;
      const trackingUrl = carrier === 'FedEx'
        ? `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number)}`
        : carrier === 'DHL'
          ? `https://www.dhl.com/us-en/home/tracking.html?submit=1&tracking-id=${encodeURIComponent(number)}`
          : null;
      const { data: updated, error } = await supabase
        .from('orders')
        .update({
          tracking_number: number,
          tracking_url: trackingUrl,
          status: 'shipped',
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

export function useReopenOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, note }: { orderId: string; note: string }) => {
      const { data: order, error: readError } = await supabase
        .from('orders')
        .select('status, tracking_number, order_details, updated_at')
        .eq('id', orderId)
        .single();
      if (readError) throw readError;
      if (!order.tracking_number) throw new Error('This order no longer has tracking. Refresh and try again.');

      const details: Record<string, unknown> = order.order_details && typeof order.order_details === 'object' && !Array.isArray(order.order_details)
        ? { ...order.order_details }
        : {};
      const previousHistory = Array.isArray(details[REOPEN_HISTORY_KEY]) ? details[REOPEN_HISTORY_KEY] : [];
      details[REOPEN_HISTORY_KEY] = [...previousHistory, {
        tracking_number: order.tracking_number,
        carrier: details[TRACKING_CARRIER_KEY] || null,
        reopened_at: new Date().toISOString(),
        note: note.trim(),
      }];
      delete details[TRACKING_ADDED_AT_KEY];
      delete details[TRACKING_CARRIER_KEY];

      const { data: updated, error } = await supabase
        .from('orders')
        .update({ status: 'processing', tracking_number: null, tracking_url: null, tracking_seen: false, order_details: details })
        .eq('id', orderId)
        .eq('tracking_number', order.tracking_number)
        .eq('updated_at', order.updated_at)
        .select('id');
      if (error) throw error;
      if (!updated?.length) throw new Error('Order changed while reopening. Refresh and try again.');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
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

export function useUndoOrderPlaced() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'pending' })
        .eq('id', orderId)
        .eq('status', 'processing')
        .is('tracking_number', null)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Order can no longer be unplaced. Refresh and check its tracking.');
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
