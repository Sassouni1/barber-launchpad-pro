import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAllOrders, useUpdateTracking, useReopenOrder, useMarkOrderPlaced, useUndoOrderPlaced, useDeleteOrder, TRACKING_ADDED_AT_KEY, REOPEN_HISTORY_KEY } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Truck, Check, CheckCircle2, Circle, Search, Copy, Trash2, Pencil, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Order = Tables<'orders'>;

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
  tracking: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  shipped: 'bg-green-500/10 text-green-500 border-green-500/30',
};

function getDisplayStatus(order: Order): { label: string; color: string } {
  if (order.tracking_number) return { label: 'Completed / Shipped', color: statusColors.shipped };
  if (order.status === 'pending') return { label: 'New Order', color: statusColors.new };
  return { label: 'Needs Tracking', color: statusColors.tracking };
}

const ORDER_SPEC_KEYS: (string | { display: string; keys: string[] })[] = [
  { display: 'Choose Color', keys: ['Choose Color', 'Hair Color'] },
  'Lace or Skin',
  'Curl Pattern — only if needed',
  { display: 'Choose Density', keys: ['Choose Density if Needed (75%-110%) - 100% is regular'] },
  'Hair Salon Service Requested',
];

function extractBarberInfo(details: Record<string, any> | null): { name: string; phone: string } {
  if (!details) return { name: '', phone: '' };
  const name = details.full_name || details.name || details.contact?.name || '';
  const phone = details.phone || details.order?.customer?.phone || '';
  return { name, phone };
}

function extractLineItems(details: Record<string, any> | null): { items: string[]; shipping: string | null } {
  if (!details) return { items: [], shipping: null };
  const order = details.order || details;
  const rawItems = order.line_items;
  if (!Array.isArray(rawItems)) return { items: [], shipping: null };
  let shipping: string | null = null;
  const items = rawItems.map((item: any) => {
    let title = String(item.title || '')
      .replace(/\s*@\s*\d+/g, '')
      .replace(/\s*\(\$[\d.,]+[^)]*\)/gi, '')
      .trim();
    const dashParts = title.split(/\s*-\s*/);
    if (dashParts.length === 2 && dashParts[0].trim().toLowerCase() === dashParts[1].trim().toLowerCase()) {
      title = dashParts[0].trim();
    } else {
      title = title.replace(/\s*-\s*Hair System$/i, '').trim();
    }
    return title;
  }).filter((title: string) => {
    if (/rush\s*ship|over\s*night/i.test(title)) {
      shipping = title;
      return false;
    }
    return Boolean(title);
  });
  return { items, shipping };
}

function extractOrderDetails(details: Record<string, any> | null): { key: string; value: string }[] {
  if (!details) return [];
  const items: { key: string; value: string }[] = [];
  for (const spec of ORDER_SPEC_KEYS) {
    const isAlias = typeof spec === 'object';
    const displayKey = isAlias ? spec.display : spec;
    const keysToCheck = isAlias ? spec.keys : [spec];
    for (const k of keysToCheck) {
      const val = details[k];
      if (val && typeof val === 'string' && val.trim() && val.trim().toLowerCase() !== 'none' && val.trim().toLowerCase() !== 'no') {
        items.push({ key: displayKey, value: val.trim() });
        break;
      }
    }
  }
  return items;
}


interface OrderCardProps {
  order: Order;
  index?: number;
  editingId: string | null;
  trackingNumber: string;
  reopenNote: string;
  setEditingId: (id: string | null) => void;
  setTrackingNumber: (v: string) => void;
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
  isAdmin?: boolean;
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

function OrderCard({ order, index, editingId, trackingNumber, reopenNote, setEditingId, setTrackingNumber, setReopenNote, onSave, onReopen, isSaving, isReopening, onOrderPlaced, isPlacingOrder, onUndoOrderPlaced, isUndoingOrder, isPast, isAdmin, onDelete }: OrderCardProps) {
  const details = order.order_details as Record<string, any> | null;
  const specs = extractOrderDetails(details);
  const { items: lineItems, shipping } = extractLineItems(details);
  const barber = extractBarberInfo(details);
  const reopenHistory = details && Array.isArray(details[REOPEN_HISTORY_KEY]) ? details[REOPEN_HISTORY_KEY] : [];
  const lastReopen = reopenHistory.at(-1);
  const isReopened = reopenHistory.length > 0 && order.status === 'processing' && !order.tracking_number;
  const displayStatus = isPast && !order.tracking_number && !isReopened
    ? { label: 'Past Order', color: 'bg-muted text-muted-foreground border-border' }
    : getDisplayStatus(order);

  const buildCopyAllText = () => {
    const lines: string[] = [];
    if (barber.name) lines.push(`Name: ${barber.name}`);
    if (barber.phone) lines.push(`Phone: ${barber.phone}`);
    if (lineItems.length > 0) lines.push(`Product: ${lineItems[0]}`);
    if (lineItems.length > 1) lines.push(`Add Ons: ${lineItems.slice(1).join(', ')}`);
    specs.forEach(s => lines.push(`${s.key}: ${s.value}`));
    if (shipping) lines.push(`Shipping: ${shipping}`);
    if (order.tracking_number) lines.push(`Tracking: ${order.tracking_number}`);
    return lines.join('\n');
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                {index != null && <span className="text-sm font-mono text-muted-foreground">#{index}</span>}
                <span className="font-medium break-words">{barber.name || 'Unknown'}</span>
                <Badge variant="outline" className={displayStatus.color}>{displayStatus.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(order.order_date), 'MMM d, yyyy h:mm a')}
              </p>
              {order.tracking_number && (
                <p className="text-sm flex items-center gap-1.5 flex-wrap">
                  Tracking: <span className="font-mono break-all">{order.tracking_number}</span>
                  <CopyBtn text={order.tracking_number} label="Tracking" />
                </p>
              )}
              {lastReopen && (
                <p className="text-xs text-muted-foreground">
                  Previously reopened from tracking {lastReopen.tracking_number}{lastReopen.note ? ` — ${lastReopen.note}` : ''}
                </p>
              )}
            </div>

            {(!isPast || order.tracking_number || isReopened || (isAdmin && onDelete)) && <div className="flex flex-col items-end gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2 sm:flex-row sm:items-center sm:p-2.5">
              {editingId === order.id ? (
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                  <Input
                    placeholder="Tracking #"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-36 sm:w-40"
                  />
                  {order.tracking_number && <Input
                    placeholder="Reason for reopening (optional)"
                    aria-label="Reason for reopening"
                    value={reopenNote}
                    onChange={(e) => setReopenNote(e.target.value)}
                    className="w-52"
                  />}
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => onSave(order.id)} disabled={isSaving || isReopening || !trackingNumber.trim()} aria-label="Save tracking">
                      <Check className="w-4 h-4 mr-1" /> Save tracking
                    </Button>
                    {order.tracking_number && <Button size="sm" variant="outline" onClick={() => onReopen(order.id)} disabled={isSaving || isReopening}>
                      <RotateCcw className="w-4 h-4 mr-1" /> Reopen order
                    </Button>}
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
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
                        setReopenNote('');
                      }}
                    >
                      {order.tracking_number ? <Pencil className="w-4 h-4 mr-1" /> : <Truck className="w-4 h-4 mr-1" />}
                      {order.tracking_number ? 'Manage Order' : 'Add Tracking'}
                    </Button>
                  )}
                  {isAdmin && onDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
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

          {lineItems.length > 0 && (
            <div className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3 flex items-center gap-1.5">
              <span>{lineItems[0]}</span>
              <CopyBtn text={lineItems[0]} label="Product" />
            </div>
          )}

          {lineItems.length > 1 && (
            <div className="text-sm flex items-center gap-1.5">
              <span className="text-muted-foreground font-medium">Add Ons: </span>
              <span className="text-muted-foreground">{lineItems.slice(1).join(', ')}</span>
              <CopyBtn text={lineItems.slice(1).join(', ')} label="Add Ons" />
            </div>
          )}

          {(barber.phone || specs.length > 0 || shipping) && (
            <div className="flex flex-col gap-1.5">
              {barber.phone && (
                <div className="text-sm flex items-center gap-1.5">
                  <span className="text-muted-foreground">Phone: </span>
                  <span className="font-medium">{barber.phone}</span>
                  <CopyBtn text={barber.phone} label="Phone" />
                </div>
              )}
              {specs.map((spec, i) => (
                <div key={i} className="text-sm flex items-center gap-1.5">
                  <span className="text-muted-foreground">{spec.key}: </span>
                  <span className="font-medium">{spec.value}</span>
                  <CopyBtn text={spec.value} label={spec.key} />
                </div>
              ))}
              {shipping && (
                <div className="text-sm flex items-center gap-1.5">
                  <span className="text-muted-foreground">Shipping: </span>
                  <span className="font-medium">{shipping}</span>
                  <CopyBtn text={shipping} label="Shipping" />
                </div>
              )}
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

export default function ManufacturerOrders() {
  const { data: orders, isLoading } = useAllOrders();
  const updateTracking = useUpdateTracking();
  const reopenOrder = useReopenOrder();
  const markOrderPlaced = useMarkOrderPlaced();
  const undoOrderPlaced = useUndoOrderPlaced();
  const deleteOrder = useDeleteOrder();
  const { isAdmin } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [reopenNote, setReopenNote] = useState('');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleSave = async (orderId: string) => {
    try {
      await updateTracking.mutateAsync({ orderId, trackingNumber: trackingNumber.trim() });
      toast.success(trackingNumber.trim() ? 'Tracking added — order completed / shipped' : 'Tracking removed — order needs tracking');
      setEditingId(null);
      setTrackingNumber('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update tracking');
    }
  };

  const handleReopen = async (orderId: string) => {
    try {
      await reopenOrder.mutateAsync({ orderId, note: reopenNote });
      toast.success('Order reopened — needs tracking');
      setEditingId(null);
      setTrackingNumber('');
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
      const details = o.order_details as Record<string, any> | null;
      const barber = extractBarberInfo(details);
      return (
        barber.name.toLowerCase().includes(q) ||
        barber.phone.toLowerCase().includes(q) ||
        o.customer_email?.toLowerCase().includes(q) ||
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
    try {
      await deleteOrder.mutateAsync(orderId);
      toast.success('Order deleted');
    } catch {
      toast.error('Failed to delete order');
    }
  };

  const cardProps = {
    editingId,
    trackingNumber,
    reopenNote,
    setEditingId,
    setTrackingNumber,
    setReopenNote,
    onSave: handleSave,
    onReopen: handleReopen,
    isSaving: updateTracking.isPending,
    isReopening: reopenOrder.isPending,
    onOrderPlaced: handleOrderPlaced,
    isPlacingOrder: markOrderPlaced.isPending,
    onUndoOrderPlaced: handleUndoOrderPlaced,
    isUndoingOrder: undoOrderPlaced.isPending,
    isAdmin,
    onDelete: isAdmin ? handleDelete : undefined,
  };

  return (
    <DashboardLayout>
       <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Order Management</h1>
            <p className="text-muted-foreground text-sm mt-1">Place new orders, add tracking, and see past orders in one place.</p>
          </div>
          <div className="relative w-64">
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
