import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables, Json } from '@/integrations/supabase/types';
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

// /newtimes is public by owner request; it goes through the scoped newtimes-orders function.
async function supplierAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('newtimes-orders', { body });
  if (error) {
    let message = 'Request failed. Refresh and try again.';
    try { const ctx = await (error as { context?: Response }).context?.json(); if (ctx?.error) message = ctx.error; } catch { /* keep default */ }
    throw new Error(message);
  }
  return data;
}

export function useAllOrders(publicSupplier = false) {
  return useQuery({
    queryKey: ['orders', 'all', publicSupplier ? 'supplier' : 'direct'],
    queryFn: async () => {
      if (publicSupplier) return receiptEligibleOrders((await supplierAction({ action: 'list' })).orders as Order[]);
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

export function useUpdateTracking(publicSupplier = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, trackingNumber, carrier }: { orderId: string; trackingNumber: string; carrier: TrackingCarrier }) => {
      if (publicSupplier) { await supplierAction({ action: 'update_tracking', orderId, trackingNumber: trackingNumber.trim(), carrier }); return; }
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

export function useReopenOrder(publicSupplier = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, note }: { orderId: string; note: string }) => {
      if (publicSupplier) { await supplierAction({ action: 'reopen', orderId, note }); return; }
      const { data: order, error: readError } = await supabase
        .from('orders')
        .select('status, tracking_number, order_details, updated_at')
        .eq('id', orderId)
        .single();
      if (readError) throw readError;
      if (!order.tracking_number) throw new Error('This order no longer has tracking. Refresh and try again.');

      const details: Record<string, Json | undefined> = order.order_details && typeof order.order_details === 'object' && !Array.isArray(order.order_details)
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

export function useMarkOrderPlaced(publicSupplier = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      if (publicSupplier) { await supplierAction({ action: 'mark_placed', orderId }); return; }
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

export function useUndoOrderPlaced(publicSupplier = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      if (publicSupplier) { await supplierAction({ action: 'undo_placed', orderId }); return; }
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
        .eq('id', orderId)
        .select('id')
        .single();
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
