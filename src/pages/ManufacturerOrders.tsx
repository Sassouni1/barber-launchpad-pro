import { useState, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAllOrders, useUpdateTracking } from '@/hooks/useOrders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Loader2, Truck, Check, ChevronDown, Search, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Order = Tables<'orders'>;

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  processing: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  shipped: 'bg-green-500/10 text-green-500 border-green-500/30',
  completed: 'bg-primary/10 text-primary border-primary/30',
};

function getDisplayStatus(order: { status: string; order_date: string }): string {
  if (order.status === 'shipped') {
    const shippedDate = new Date(order.order_date);
    const daysSince = (Date.now() - shippedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= 7) return 'completed';
  }
  return order.status;
}

const ORDER_SPEC_KEYS: (string | { display: string; keys: string[] })[] = [
  { display: 'Choose Color', keys: ['Choose Color', 'Hair Color'] },
  'Lace or Skin',
  'Curl Pattern — only if needed',
  'Hair Salon Service Requested',
  'Any Notes you may want to add',
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
  setEditingId: (id: string | null) => void;
  setTrackingNumber: (v: string) => void;
  onSave: (orderId: string) => void;
  isSaving: boolean;
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

function OrderCard({ order, index, editingId, trackingNumber, setEditingId, setTrackingNumber, onSave, isSaving }: OrderCardProps) {
  const details = order.order_details as Record<string, any> | null;
  const specs = extractOrderDetails(details);
  const { items: lineItems, shipping } = extractLineItems(details);
  const barber = extractBarberInfo(details);

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
      <CardContent className="p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                {index != null && <span className="text-sm font-mono text-muted-foreground">#{index}</span>}
                <span className="font-medium">{barber.name || 'Unknown'}</span>
                <Badge variant="outline" className={statusColors[getDisplayStatus(order)] || ''}>
                  {getDisplayStatus(order).charAt(0).toUpperCase() + getDisplayStatus(order).slice(1)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(order.order_date), 'MMM d, yyyy h:mm a')}
              </p>
              {order.tracking_number && (
                <p className="text-sm flex items-center gap-1.5">
                  Tracking: <span className="font-mono">{order.tracking_number}</span>
                  <CopyBtn text={order.tracking_number} label="Tracking" />
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {editingId === order.id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="Tracking #"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-40"
                  />
                  <Button size="sm" onClick={() => onSave(order.id)} disabled={isSaving}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(order.id);
                    setTrackingNumber(order.tracking_number || '');
                  }}
                >
                  <Truck className="w-4 h-4 mr-1" />
                  {order.tracking_number ? 'Edit Tracking' : 'Add Tracking'}
                </Button>
              )}
            </div>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [search, setSearch] = useState('');

  const handleSave = async (orderId: string) => {
    try {
      await updateTracking.mutateAsync({ orderId, trackingNumber: trackingNumber.trim() });
      toast.success(trackingNumber.trim() ? 'Tracking added' : 'Tracking removed — order set back to pending');
      setEditingId(null);
      setTrackingNumber('');
    } catch {
      toast.error('Failed to update tracking');
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

  const allNew = useMemo(() => (orders?.filter(o => !o.tracking_number) ?? []).reverse(), [orders]);
  const allPrevious = useMemo(() => (orders?.filter(o => !!o.tracking_number) ?? []).reverse(), [orders]);
  const newOrders = useMemo(() => filterOrders(allNew), [allNew, search]);
  const previousOrders = useMemo(() => filterOrders(allPrevious), [allPrevious, search]);

  const cardProps = {
    editingId,
    trackingNumber,
    setEditingId,
    setTrackingNumber,
    onSave: handleSave,
    isSaving: updateTracking.isPending,
  };

  return (
    <DashboardLayout>
       <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Order Management</h1>
            <p className="text-muted-foreground text-sm mt-1">New Orders</p>
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
        ) : !orders?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No orders yet
            </CardContent>
          </Card>
        ) : (
          <>
            {newOrders.length > 0 ? (
              <div className="space-y-3">
                {newOrders.map((order, i) => (
                  <OrderCard key={order.id} order={order} index={i + 1} {...cardProps} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No new orders
                </CardContent>
              </Card>
            )}

            {previousOrders.length > 0 && (
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group w-full">
                  <ChevronDown className="w-4 h-4 transition-transform group-data-[state=closed]:-rotate-90" />
                  Previous Orders ({previousOrders.length})
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3">
                  {previousOrders.map((order) => (
                    <OrderCard key={order.id} order={order} {...cardProps} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
