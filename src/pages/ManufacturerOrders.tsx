import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAllOrders, useUpdateTracking } from '@/hooks/useOrders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Truck, Check } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

// Keys from GHL order_details that represent the actual order specs
const ORDER_SPEC_KEYS = [
  'Client Name',
  'Choose Color',
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

function extractLineItems(details: Record<string, any> | null): string[] {
  if (!details) return [];
  const order = details.order || details;
  const items = order.line_items;
  if (!Array.isArray(items)) return [];
  return items.map((item: any) =>
    String(item.title || '')
      .replace(/\s*@\s*\d+/g, '')
      .replace(/\s*-\s*Hair System$/i, '')
      .replace(/\s*\(\$[\d.,]+[^)]*\)/gi, '')
      .trim()
  ).filter(Boolean);
}


// Extract meaningful order details from the raw GHL payload
function extractOrderDetails(details: Record<string, any> | null): { key: string; value: string }[] {
  if (!details) return [];
  
  const items: { key: string; value: string }[] = [];
  
  for (const key of ORDER_SPEC_KEYS) {
    const val = details[key];
    if (val && typeof val === 'string' && val.trim() && val.trim().toLowerCase() !== 'none' && val.trim().toLowerCase() !== 'no') {
      items.push({ key, value: val.trim() });
    }
  }
  
  return items;
}

function OrderSpecBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 border border-border/50 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default function ManufacturerOrders() {
  const { data: orders, isLoading } = useAllOrders();
  const updateTracking = useUpdateTracking();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  
  

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

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Order Management</h1>
          <p className="text-muted-foreground text-sm mt-1">New Orders</p>
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
          <div className="space-y-3">
            {orders.map((order) => {
              const details = order.order_details as Record<string, any> | null;
              const specs = extractOrderDetails(details);
              const lineItems = extractLineItems(details);
              const barber = extractBarberInfo(details);
              const clientName = order.customer_name || '';
              const showClient = clientName && clientName.toLowerCase() !== barber.name.toLowerCase();

              return (
                <Card key={order.id} className="border-border/50">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3">
                      {/* Header row */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-medium">{barber.name || 'Unknown'}</span>
                            {barber.phone && <span className="text-sm text-muted-foreground">{barber.phone}</span>}
                            <Badge variant="outline" className={statusColors[getDisplayStatus(order)] || ''}>
                              {getDisplayStatus(order).charAt(0).toUpperCase() + getDisplayStatus(order).slice(1)}
                            </Badge>
                          </div>
                          {showClient && (
                            <p className="text-sm text-muted-foreground">Client: <span className="font-medium text-foreground">{clientName}</span></p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.order_date), 'MMM d, yyyy h:mm a')}
                          </p>
                          {order.tracking_number && (
                            <p className="text-sm">Tracking: <span className="font-mono">{order.tracking_number}</span></p>
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
                              
                              <Button size="sm" onClick={() => handleSave(order.id)} disabled={updateTracking.isPending}>
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

                      {/* Line items */}
                      {lineItems.length > 0 && (
                        <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
                          {lineItems[0]}
                        </p>
                      )}

                      {/* Add Ons */}
                      {lineItems.length > 1 && (
                        <div className="text-sm">
                          <span className="text-muted-foreground font-medium">Add Ons: </span>
                          <span className="text-muted-foreground">{lineItems.slice(1).join(', ')}</span>
                        </div>
                      )}

                      {/* Order specs summary */}
                      {specs.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {specs.map((spec, i) => (
                            <OrderSpecBadge key={i} label={spec.key} value={spec.value} />
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
