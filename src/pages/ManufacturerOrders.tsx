import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAllOrders, useUpdateTracking, useReopenOrder, useMarkOrderPlaced, useUndoOrderPlaced, useDeleteOrder, TRACKING_ADDED_AT_KEY, TRACKING_CARRIER_KEY, REOPEN_HISTORY_KEY, type TrackingCarrier } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Truck, Check, CheckCircle2, Circle, Search, Copy, Trash2, Pencil, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { manufacturerOrderView, orderSearchFromQuery } from '@/lib/manufacturerOrderDetails';
import { isNewOrderOverdue } from '@/lib/manufacturerOrderUrgency';
import { KIT_MANIFEST } from '@/lib/supplierKitOrder';

type Order = Tables<'orders'>;
const TRACKING_CARRIERS: TrackingCarrier[] = ['DHL', 'FedEx', 'Other'];

function savedTrackingCarrier(order: Order): TrackingCarrier | null {
  const details = order.order_details;
  const value = details && typeof details === 'object' && !Array.isArray(details)
    ? details[TRACKING_CARRIER_KEY]
    : null;
  return TRACKING_CARRIERS.find(carrier => carrier === value) ?? null;
}

// Nikkole Abila's October 20 order is the first current order (6:48 PM PDT).
const CURRENT_ORDERS_START = new Date('2026-10-21T01:48:00Z').getTime();
const PAST_ORDER_DELAY_MS = 8 * 24 * 60 * 60 * 1000;

function trackingAddedAt(order: Order): number | null {
  if (!order.tracking_number) return null;
  const details = order.order_details;
  const savedAt = details && typeof details === 'object' && !Array.isArray(details)
    ? details[TRACKING_ADDED_AT_KEY]
    : null;
  const timestamp = Date.parse(typeof savedAt === 'string' ? savedAt : order.updated_at);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isPastOrder(order: Order, now: number): boolean {
  if (new Date(order.order_date).getTime() < CURRENT_ORDERS_START) return true;
  const addedAt = trackingAddedAt(order);
  return addedAt !== null && now - addedAt >= PAST_ORDER_DELAY_MS;
}

const statusColors: Record<string, string> = {
  new: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  overdue: 'bg-red-500/15 text-red-400 border-red-500/50',
  tracking: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  shipped: 'bg-green-500/10 text-green-500 border-green-500/30',
};

function getDisplayStatus(order: Order, overdue: boolean): { label: string; color: string } {
  if (order.tracking_number) return { label: 'Completed / Shipped', color: statusColors.shipped };
  if (order.status === 'pending') return overdue
    ? { label: 'New Order · Overdue', color: statusColors.overdue }
    : { label: 'New Order', color: statusColors.new };
  return { label: 'Needs Tracking', color: statusColors.tracking };
}

interface OrderCardProps {
  order: Order;
  now: number;
  isPreview?: boolean;
  index?: number;
  editingId: string | null;
  trackingNumber: string;
  trackingCarrier: TrackingCarrier | null;
  reopenNote: string;
  setEditingId: (id: string | null) => void;
  setTrackingNumber: (v: string) => void;
  setTrackingCarrier: (v: TrackingCarrier | null) => void;
  setReopenNote: (v: string) => void;
  onSave: (orderId: string) => void;
  onReopen: (orderId: string) => void;
  isSaving: boolean;
  isReopening: boolean;
  onOrderPlaced: (orderId: string) => void;
  isPlacingOrder: boolean;
  onUndoOrderPlaced: (orderId: string) => void;
  isUndoingOrder: boolean;
  isPast?: boolean;
  onDelete?: (orderId: string) => void;
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        toast.success(`${label || 'Text'} copied`);
      }}
      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
    >
      <Copy className="w-3.5 h-3.5" />
    </button>
  );
}

function OrderCard({ order, now, isPreview, index, editingId, trackingNumber, trackingCarrier, reopenNote, setEditingId, setTrackingNumber, setTrackingCarrier, setReopenNote, onSave, onReopen, isSaving, isReopening, onOrderPlaced, isPlacingOrder, onUndoOrderPlaced, isUndoingOrder, isPast, onDelete }: OrderCardProps) {
  const trackingInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editingId === order.id && trackingCarrier) trackingInputRef.current?.focus();
  }, [editingId, order.id, trackingCarrier]);
  const details = order.order_details as Record<string, unknown> | null;
  const view = manufacturerOrderView({ orderDetails: details, customerName: order.customer_name, customerEmail: order.customer_email });
  const { specs, items: lineItems, shippingMethod, shippingAddress } = view;
  const barber = { name: view.name, phone: view.phone };
  const savedCarrier = savedTrackingCarrier(order);
  const reopenHistory = details && Array.isArray(details[REOPEN_HISTORY_KEY])
    ? details[REOPEN_HISTORY_KEY] as Array<{ tracking_number?: string; note?: string }>
    : [];
  const lastReopen = reopenHistory.at(-1);
  const isReopened = reopenHistory.length > 0 && order.status === 'processing' && !order.tracking_number;
  const overdue = !isPast && !order.tracking_number && order.status === 'pending' && isNewOrderOverdue(order.order_date, now);
  const needsTracking = !isPast && !order.tracking_number && order.status === 'processing';
  const displayStatus = isPast && !order.tracking_number && !isReopened
    ? { label: 'Past Order', color: 'bg-muted text-muted-foreground border-border' }
    : getDisplayStatus(order, overdue);

  const buildCopyAllText = () => {
    const lines: string[] = [];
    if (barber.name) lines.push(`Name: ${barber.name}`);
    if (barber.phone) lines.push(`Phone: ${barber.phone}`);
    if (view.email) lines.push(`Email: ${view.email}`);
    if (lineItems.length > 0) lines.push(`${view.isKit ? 'Kit contents' : 'Product'}: ${lineItems.join(', ')}`);
    specs.forEach(s => lines.push(`${s.label}: ${s.value}`));
    if (shippingMethod) lines.push(`Shipping method: ${shippingMethod}`);
    lines.push(`Shipping address: ${shippingAddress.join(', ') || 'Not provided'}`);
    if (view.notes) lines.push(`Order notes: ${view.notes}`);
    if (view.instruction) lines.push(view.instruction);
    if (order.tracking_number) lines.push(`Tracking: ${savedCarrier ? `${savedCarrier} ` : ''}${order.tracking_number}`);
    return lines.join('\n');
  };

  return (
    <Card className={overdue ? 'border-red-500/60 bg-red-500/10' : needsTracking ? 'border-amber-400/50 bg-amber-400/5' : 'border-border/50'}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 basis-[220px] flex-1 space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                {index != null && <span className="text-sm font-mono text-muted-foreground">#{index}</span>}
                <span className="font-medium break-words">{barber.name || 'Unknown'}</span>
                <Badge variant="outline" className={displayStatus.color}>{displayStatus.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(order.order_date), 'MMM d, yyyy h:mm a')}
              </p>
              {order.external_order_id && <p className="text-xs text-muted-foreground break-all">Order reference: {order.external_order_id}</p>}
              {view.sequence && <p className="text-xs text-muted-foreground">{view.sequence}</p>}
              {order.tracking_number && (
                <p className="text-sm flex items-center gap-1.5 flex-wrap">
                  Tracking: {savedCarrier && <span className="font-semibold">{savedCarrier}</span>}
                  <span className="font-mono break-all">{order.tracking_number}</span>
                  <CopyBtn text={order.tracking_number} label="Tracking" />
                  {order.tracking_url && savedCarrier && <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Track package</a>}
                </p>
              )}
              {lastReopen && (
                <p className="text-xs text-muted-foreground">
                  Previously reopened from tracking {lastReopen.tracking_number}{lastReopen.note ? ` — ${lastReopen.note}` : ''}
                </p>
              )}
            </div>

            {!isPreview && (!isPast || order.tracking_number || isReopened || onDelete) && <div className={`flex flex-col gap-2 ${editingId === order.id ? 'w-full items-stretch rounded-lg border border-primary/20 bg-primary/5 p-2 sm:w-[320px] sm:p-2.5' : 'items-start sm:flex-row sm:items-center'}`}>
              {editingId === order.id ? (
                <div className="flex w-full flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Carrier</span>
                  <div role="group" aria-label="Shipping carrier" className="grid grid-cols-3 gap-1.5">
                    {TRACKING_CARRIERS.map(carrier => (
                      <Button key={carrier} size="sm" type="button" variant="outline" className={`px-1 text-xs font-semibold ${trackingCarrier === carrier ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary'}`} aria-pressed={trackingCarrier === carrier} onClick={() => setTrackingCarrier(carrier)}>
                        {carrier}
                      </Button>
                    ))}
                  </div>
                  {(trackingCarrier || order.tracking_number) && <Input
                    ref={trackingInputRef}
                    placeholder="Tracking #"
                    aria-label="Tracking number"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full border-amber-400 bg-amber-400/5 ring-2 ring-amber-400/60 focus-visible:border-amber-300 focus-visible:ring-amber-300"
                  />}
                  {order.tracking_number && <Input
                    placeholder="Issue or reason (optional)"
                    aria-label="Issue or reason for reopening"
                    value={reopenNote}
                    onChange={(e) => setReopenNote(e.target.value)}
                    className="w-full"
                  />}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => onSave(order.id)} disabled={isSaving || isReopening || !trackingCarrier || !trackingNumber.trim()} aria-label="Save tracking">
                      <Check className="w-4 h-4 mr-1" /> Save tracking
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                  {order.tracking_number && <Button size="sm" variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary" onClick={() => onReopen(order.id)} disabled={isSaving || isReopening}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Issue / Reopen Order
                  </Button>}
                </div>
              ) : (
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  {!isPast && !order.tracking_number && (order.status === 'pending' || order.status === 'processing') && (
                    <Button
                      variant="outline"
                      aria-pressed={order.status === 'processing'}
                      title={order.status === 'processing' ? 'Click to unmark order placed' : 'Click to mark order placed'}
                      onClick={() => order.status === 'processing' ? onUndoOrderPlaced(order.id) : onOrderPlaced(order.id)}
                      disabled={isPlacingOrder || isUndoingOrder}
                      className={`h-auto min-h-10 w-40 whitespace-normal px-2 py-2 text-xs font-semibold leading-tight shadow-sm sm:w-auto sm:min-w-[162px] sm:px-4 sm:text-sm ${order.status === 'processing' ? 'border-green-500/60 bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-400' : 'border-primary/70 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary'}`}
                    >
                      {order.status === 'processing' ? <CheckCircle2 className="mr-1" /> : <Circle className="mr-1" />}
                      {order.status === 'processing' ? 'Order placed' : 'Mark as Order Placed'}
                    </Button>
                  )}
                  {(!isPast || order.tracking_number || isReopened) && (
                    <Button
                      className="w-40 border border-amber-300 bg-amber-400 text-black font-semibold shadow-sm hover:bg-amber-300 hover:text-black sm:w-auto sm:min-w-[132px]"
                      onClick={() => {
                        setEditingId(order.id);
                        setTrackingNumber(order.tracking_number || '');
                        setTrackingCarrier(savedCarrier);
                        setReopenNote('');
                      }}
                    >
                      {order.tracking_number ? <Pencil className="w-4 h-4 mr-1" /> : <Truck className="w-4 h-4 mr-1" />}
                      {order.tracking_number ? 'Manage Order' : 'Add Tracking'}
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete order"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (window.confirm('Delete this order?')) {
                          onDelete(order.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>}
          </div>

          <div className="min-w-0 text-sm text-muted-foreground border-l-2 border-primary/30 pl-3 flex items-center gap-1.5">
            <span className="min-w-0 break-words"><strong>{view.isKit ? 'Kit contents' : 'Product'}:</strong> {lineItems.join(', ') || 'Not provided'}</span>
            {!!lineItems.length && <CopyBtn text={lineItems.join(', ')} label={view.isKit ? 'Kit contents' : 'Product'} />}
          </div>

          {(barber.phone || view.email || specs.length > 0 || shippingMethod || shippingAddress.length > 0 || view.notes || view.instruction) && (
            <div className="flex flex-col gap-1.5">
              {barber.phone && (
                <div className="text-sm flex items-center gap-1.5">
                  <span className="text-muted-foreground">Phone: </span>
                  <span className="font-medium">{barber.phone}</span>
                  <CopyBtn text={barber.phone} label="Phone" />
                </div>
              )}
              {view.email && <div className="text-sm flex items-center gap-1.5"><span className="text-muted-foreground">Email: </span><span className="font-medium break-all">{view.email}</span><CopyBtn text={view.email} label="Email" /></div>}
              {specs.map((spec, i) => (
                <div key={i} className="text-sm flex items-center gap-1.5">
                  <span className="text-muted-foreground">{spec.label}: </span>
                  <span className="font-medium">{spec.value}</span>
                  <CopyBtn text={spec.value} label={spec.label} />
                </div>
              ))}
              {shippingMethod && (
                <div className="text-sm flex items-center gap-1.5">
                  <span className="text-muted-foreground">Shipping method: </span>
                  <span className="font-medium">{shippingMethod}</span>
                  <CopyBtn text={shippingMethod} label="Shipping method" />
                </div>
              )}
              <div className="min-w-0 text-sm flex items-start gap-1.5"><span className="text-muted-foreground shrink-0">Shipping address: </span><span className="min-w-0 break-words font-medium">{shippingAddress.join(', ') || 'Not provided'}</span>{!!shippingAddress.length && <CopyBtn text={shippingAddress.join(', ')} label="Shipping address" />}</div>
              {view.notes && <div className="text-sm flex items-start gap-1.5"><span className="text-muted-foreground shrink-0">Order notes: </span><span className="font-medium whitespace-pre-wrap">{view.notes}</span><CopyBtn text={view.notes} label="Order notes" /></div>}
              {view.instruction && <div className="text-sm font-medium text-primary">{view.instruction}</div>}
            </div>
          )}

          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(buildCopyAllText());
                toast.success('All order details copied');
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              Copy All
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function kitPreviewOrder(now: number, status: 'pending' | 'processing'): Order {
  const timestamp = new Date(status === 'pending' ? now - 7 * 24 * 60 * 60 * 1000 : now).toISOString();
  return {
    id: `kit-preview-${status}`,
    checkout_draft_id: null,
    created_at: timestamp,
    customer_email: 'sample@example.com',
    customer_name: 'Sample Buyer',
    external_order_id: `KIT-PREVIEW-${status.toUpperCase()}`,
    order_date: timestamp,
    order_details: {
      supplier_kit: true,
      full_name: 'Sample Buyer',
      phone: '(555) 010-0000',
      shipping_address: { name: 'Sample Buyer', address1: '123 Example Street', city: 'Example City', state: 'CA', postal_code: '90000', country: 'US' },
      order: { line_items: KIT_MANIFEST.map(item => ({ ...item })) },
    },
    payment_reference: null,
    status,
    stripe_checkout_session_id: null,
    system_index: null,
    tracking_number: null,
    tracking_seen: false,
    tracking_url: null,
    updated_at: timestamp,
    user_id: null,
  };
}

export default function ManufacturerOrders({ adminView = false }: { adminView?: boolean }) {
  const location = useLocation();
  const { data: orders, isLoading } = useAllOrders();
  const updateTracking = useUpdateTracking();
  const reopenOrder = useReopenOrder();
  const markOrderPlaced = useMarkOrderPlaced();
  const undoOrderPlaced = useUndoOrderPlaced();
  const deleteOrder = useDeleteOrder();
  const { isAdmin, user } = useAuth();
  const canDeleteOrders = adminView && isAdmin && user?.email?.toLowerCase() === 'chris@invasiondigitalmedia.com';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState<TrackingCarrier | null>(null);
  const [reopenNote, setReopenNote] = useState('');
  const [search, setSearch] = useState(() => orderSearchFromQuery(location.search));
  const [now, setNow] = useState(() => Date.now());
  const showKitPreview = new URLSearchParams(location.search).get('preview_kit') === '1';

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => setSearch(orderSearchFromQuery(location.search)), [location.search]);

  const handleSave = async (orderId: string) => {
    try {
      if (!trackingCarrier) throw new Error('Choose DHL, FedEx, or Other.');
      await updateTracking.mutateAsync({ orderId, trackingNumber: trackingNumber.trim(), carrier: trackingCarrier });
      toast.success('Tracking added — order completed / shipped');
      setEditingId(null);
      setTrackingNumber('');
      setTrackingCarrier(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update tracking');
    }
  };

  const handleReopen = async (orderId: string) => {
    try {
      await reopenOrder.mutateAsync({ orderId, note: reopenNote });
      toast.success('Order moved back to Needs Tracking; previous tracking saved');
      setEditingId(null);
      setTrackingNumber('');
      setTrackingCarrier(null);
      setReopenNote('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reopen order');
    }
  };

  const handleOrderPlaced = async (orderId: string) => {
    try {
      await markOrderPlaced.mutateAsync(orderId);
      toast.success('Marked as ordered — needs tracking');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark order placed');
    }
  };

  const handleUndoOrderPlaced = async (orderId: string) => {
    try {
      await undoOrderPlaced.mutateAsync(orderId);
      toast.success('Order returned to New Order');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to undo order placed');
    }
  };

  const filterOrders = (list: typeof orders) => {
    if (!search.trim()) return list ?? [];
    const q = search.toLowerCase();
    return (list ?? []).filter(o => {
      const view = manufacturerOrderView({ orderDetails: o.order_details, customerName: o.customer_name, customerEmail: o.customer_email });
      return (
        view.name.toLowerCase().includes(q) ||
        view.phone.toLowerCase().includes(q) ||
        o.customer_email?.toLowerCase().includes(q) ||
        o.external_order_id?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.tracking_number?.toLowerCase().includes(q)
      );
    });
  };

  const sortedOrders = useMemo(() => [...(orders ?? [])].sort((a, b) =>
    new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
  ), [orders]);
  const currentOrders = filterOrders(sortedOrders.filter(o => !isPastOrder(o, now) && !o.tracking_number));
  const completedOrders = filterOrders(sortedOrders.filter(o => !isPastOrder(o, now) && !!o.tracking_number));
  const pastOrders = filterOrders(sortedOrders.filter(o => isPastOrder(o, now)));

  const handleDelete = async (orderId: string) => {
    if (!canDeleteOrders) return;
    try {
      await deleteOrder.mutateAsync(orderId);
      toast.success('Order deleted');
    } catch {
      toast.error('Failed to delete order');
    }
  };

  const cardProps = {
    now,
    editingId,
    trackingNumber,
    trackingCarrier,
    reopenNote,
    setEditingId,
    setTrackingNumber,
    setTrackingCarrier,
    setReopenNote,
    onSave: handleSave,
    onReopen: handleReopen,
    isSaving: updateTracking.isPending,
    isReopening: reopenOrder.isPending,
    onOrderPlaced: handleOrderPlaced,
    isPlacingOrder: markOrderPlaced.isPending,
    onUndoOrderPlaced: handleUndoOrderPlaced,
    isUndoingOrder: undoOrderPlaced.isPending,
    onDelete: canDeleteOrders ? handleDelete : undefined,
  };

  return (
    <DashboardLayout isAdminView={adminView}>
       <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Order Management</h1>
            <p className="text-muted-foreground text-sm mt-1">Place new orders, add tracking, and see past orders in one place.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-10">
            {showKitPreview && (
              <section aria-label="Kit order preview" className="space-y-4 rounded-xl border border-dashed border-border/70 p-4 sm:p-5">
                <div>
                  <h2 className="font-display text-xl font-semibold">Kit order preview</h2>
                  <p className="text-sm text-muted-foreground">Sample cards only. No order was created, and these controls cannot change an order.</p>
                </div>
                <div className="space-y-3">
                  <OrderCard order={kitPreviewOrder(now, 'processing')} isPreview {...cardProps} />
                  <OrderCard order={kitPreviewOrder(now, 'pending')} isPreview {...cardProps} />
                </div>
              </section>
            )}
            {([
              { title: 'Current Orders', description: 'Newest first. Marking an order as ordered changes its status to Needs Tracking without moving it.', list: currentOrders, empty: 'No current orders need action.' },
              { title: 'Completed / Shipped', description: 'Tracking has been added. Orders move to Past Orders after eight days; delivery is not confirmed here.', list: completedOrders, empty: 'No completed / shipped orders.' },
              { title: 'Past Orders', description: 'Older orders and tracked orders eight days after tracking was added.', list: pastOrders, empty: 'No past orders.' },
            ] as const).map(section => (
              <section key={section.title} aria-label={section.title} className="space-y-4 border-t border-border/70 pt-6">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-xl font-semibold">{section.title}</h2>
                  <span className="text-sm text-muted-foreground">{section.list.length}</span>
                </div>
                <p className="text-sm text-muted-foreground">{section.description}</p>
                {section.list.length ? (
                  <div className="space-y-3">
                    {section.list.map((order, i) => (
                      <OrderCard key={order.id} order={order} index={i + 1} isPast={section.title === 'Past Orders'} {...cardProps} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 px-5 py-8 text-sm text-muted-foreground">{section.empty}</div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
