import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables, Json } from '@/integrations/supabase/types';
import { receiptEligibleOrders } from '@/lib/receiptEligibility';
import { changeExtraPackage, ensurePrimaryUnique, reopenTrackingDetails, type ExtraChange } from '../../supabase/functions/_shared/supplierTracking';

import { completionUpdate, preserveCompletionClock, trackingSaveStatus } from '../../supabase/functions/_shared/supplierOrderLifecycle';
import { shippingLocationUpdate, shippingLocations, type ShippingLocations } from '../../supabase/functions/_shared/supplierShippingLocations';

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
        .eq('user_id', user?.id ?? '')
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
    mutationFn: async ({ orderId, trackingNumber, carrier, mode }: { orderId: string; trackingNumber: string; carrier: TrackingCarrier; mode?: ShippingLocations }) => {
      if (publicSupplier) { await supplierAction({ action: 'update_tracking', orderId, trackingNumber: trackingNumber.trim(), carrier, mode }); return; }
      const number = trackingNumber.trim();
      if (!number) throw new Error('Enter a tracking number.');
      const { data: order, error: readError } = await supabase
        .from('orders')
        .select('status, tracking_number, order_details, updated_at')
        .eq('id', orderId)
        .single();
      if (readError) throw readError;

      ensurePrimaryUnique(order.order_details, number);
      const details = preserveCompletionClock(order) as Record<string, Json | undefined>;
      // Editing a tracking number must not restart the eight-day archive clock.
      details[TRACKING_ADDED_AT_KEY] = order.tracking_number
        ? details[TRACKING_ADDED_AT_KEY] || order.updated_at
        : new Date().toISOString();
      details[TRACKING_CARRIER_KEY] = carrier;
      const chosenMode = mode ?? shippingLocations(details);
      if (!order.tracking_number && !chosenMode) throw new Error('Choose one or two shipping locations.');
      const trackingUrl = carrier === 'FedEx'
        ? `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number)}`
        : carrier === 'DHL'
          ? `https://www.dhl.com/us-en/home/tracking.html?submit=1&tracking-id=${encodeURIComponent(number)}`
          : null;
      const flow = chosenMode ? shippingLocationUpdate(details, number, carrier, chosenMode, new Date().toISOString())
        : { status: trackingSaveStatus(order.status), order_details: details };
      const { data: updated, error } = await supabase
        .from('orders')
        .update({
          tracking_number: number,
          tracking_url: trackingUrl,
          status: flow.status,
          order_details: flow.order_details as Json,
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
        .select('status, tracking_number, tracking_url, order_details, updated_at')
        .eq('id', orderId)
        .single();
      if (readError) throw readError;
      if (!order.tracking_number) throw new Error('This order no longer has tracking. Refresh and try again.');

      const details = reopenTrackingDetails(order.order_details, order.tracking_number, order.tracking_url, new Date().toISOString(), note.trim()) as Json;

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

export function useAdditionalTracking(publicSupplier = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, expectedUpdatedAt, ...change }: ExtraChange & { orderId: string; expectedUpdatedAt: string }) => {
      if (publicSupplier) { await supplierAction({ ...change, orderId, expectedUpdatedAt }); return; }
      const { data: order, error: readError } = await supabase.from('orders')
        .select('status, tracking_number, order_details, updated_at').eq('id', orderId).neq('status', 'pending_payment').single();
      if (readError) throw readError;
      if (order.updated_at !== expectedUpdatedAt) throw new Error('Order changed. Refresh and try again.');
      const details = changeExtraPackage(preserveCompletionClock(order), order.tracking_number, change, new Date().toISOString(), order.updated_at);
      const mode = shippingLocations(details);
      const flow = mode ? shippingLocationUpdate(details, order.tracking_number, details[TRACKING_CARRIER_KEY] as TrackingCarrier | null, mode, new Date().toISOString())
        : { order_details: details };
      const { data, error } = await supabase.from('orders').update({ ...flow, order_details: flow.order_details as Json })
        .eq('id', orderId).neq('status', 'pending_payment').eq('updated_at', expectedUpdatedAt).eq('tracking_number', order.tracking_number).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Order changed while saving packages. Refresh and try again.');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useShippingLocations(publicSupplier = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, expectedUpdatedAt, mode }: { orderId: string; expectedUpdatedAt: string; mode: ShippingLocations }) => {
      if (publicSupplier) { await supplierAction({ action: 'set_shipping_locations', orderId, expectedUpdatedAt, mode }); return; }
      const { data: order, error: readError } = await supabase.from('orders')
        .select('status, tracking_number, order_details, updated_at').eq('id', orderId).neq('status', 'pending_payment').single();
      if (readError) throw readError;
      if (order.updated_at !== expectedUpdatedAt) throw new Error('Order changed. Refresh and try again.');
      if (!order.tracking_number) throw new Error('Add the first tracking number first.');
      const details = preserveCompletionClock(order);
      const flow = shippingLocationUpdate(details, order.tracking_number, details[TRACKING_CARRIER_KEY] as TrackingCarrier | null, mode, new Date().toISOString());
      const { data, error } = await supabase.from('orders').update({ ...flow, order_details: flow.order_details as Json })
        .eq('id', orderId).eq('updated_at', expectedUpdatedAt).eq('tracking_number', order.tracking_number).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Order changed while saving. Refresh and try again.');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useSupplierCompletion(publicSupplier = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, expectedUpdatedAt, completed }: { orderId: string; expectedUpdatedAt: string; completed: boolean }) => {
      if (publicSupplier) { await supplierAction({ action: completed ? 'complete_order' : 'undo_completion', orderId, expectedUpdatedAt }); return; }
      const { data: order, error: readError } = await supabase.from('orders')
        .select('status, tracking_number, order_details, updated_at, tracking_seen').eq('id', orderId).neq('status', 'pending_payment').single();
      if (readError) throw readError;
      if (order.updated_at !== expectedUpdatedAt) throw new Error('Order changed. Refresh and try again.');
      const patch = completionUpdate(order, completed, new Date().toISOString());
      const { data, error } = await supabase.from('orders').update({ ...patch, order_details: patch.order_details as Json })
        .eq('id', orderId).neq('status', 'pending_payment').eq('updated_at', expectedUpdatedAt).eq('status', order.status).eq('tracking_number', order.tracking_number).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Order changed while completing. Refresh and try again.');
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

// Manual "Chris paid the supplier" marker; separate from customer payment. RLS limits writes to Chris's admin account.
export function useToggleSupplierPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, paid }: { orderId: string; paid: boolean }) => {
      const { error } = paid
        ? await supabase.from('supplier_payment_markers').insert({ order_id: orderId })
        : await supabase.from('supplier_payment_markers').delete().eq('order_id', orderId);
      if (error) throw new Error(error.code === '23505' ? 'Already marked paid. Refresh.' : error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
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
        .eq('user_id', user?.id ?? '')
        .eq('status', 'shipped')
        .eq('tracking_seen', false);
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!user,
  });
}
