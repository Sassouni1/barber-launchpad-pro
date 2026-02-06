import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAllOrders, useUpdateTracking } from '@/hooks/useOrders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Truck, Check, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  processing: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  shipped: 'bg-green-500/10 text-green-500 border-green-500/30',
  delivered: 'bg-primary/10 text-primary border-primary/30',
};

// Keys from GHL order_details that represent the actual order specs
const ORDER_SPEC_KEYS = [
  'Hair Color',
  'Lace or Skin',
  'Hair Salon Service Requested',
  'When do you want to watch training?',
  'Any Notes you may want to add',
];

// Extract meaningful order details from the raw GHL payload
function extractOrderDetails(details: Record<string, any> | null): { key: string; value: string }[] {
  if (!details) return [];
  
  const items: { key: string; value: string }[] = [];
  
  // First check for known spec keys
  for (const key of ORDER_SPEC_KEYS) {
    const val = details[key];
    if (val && typeof val === 'string' && val.trim() && val.trim().toLowerCase() !== 'none') {
      items.push({ key, value: val.trim() });
    }
  }
  
  // Also scan for any field that has a non-empty value and looks like product info
  // (skip known metadata fields)
  const skipKeys = new Set([
    'email', 'first_name', 'last_name', 'full_name', 'name', 'phone',
    'address1', 'city', 'state', 'postal_code', 'country', 'full_address',
    'contact', 'contact_id', 'contact_source', 'contact_type', 'location',
    'customData', 'triggerData', 'workflow', 'date_created', 'tags',
    'timezone', 'source_url', 'user_id', 'userId',
    ...ORDER_SPEC_KEYS.map(k => k),
  ]);
  
  for (const [key, val] of Object.entries(details)) {
    if (skipKeys.has(key)) continue;
    if (typeof val === 'string' && val.trim() && val.trim().toLowerCase() !== 'none' && val.length < 200) {
      // Only include if it looks like a product attribute (has a colon-style label)
      if (key.includes('Hair') || key.includes('Lace') || key.includes('Skin') || key.includes('Color') || key.includes('product')) {
        const existing = items.find(i => i.key === key);
        if (!existing) {
          items.push({ key, value: val.trim() });
        }
      }
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
  const [trackingUrl, setTrackingUrl] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSave = async (orderId: string) => {
    if (!trackingNumber.trim()) {
      toast.error('Please enter a tracking number');
      return;
    }
    try {
      await updateTracking.mutateAsync({ orderId, trackingNumber: trackingNumber.trim(), trackingUrl: trackingUrl.trim() });
      toast.success('Tracking added');
      setEditingId(null);
      setTrackingNumber('');
      setTrackingUrl('');
    } catch {
      toast.error('Failed to update tracking');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Order Management</h1>
          <p className="text-muted-foreground text-sm mt-1">View order details and add tracking numbers</p>
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
              const specs = extractOrderDetails(order.order_details as Record<string, any>);
              const isExpanded = expandedId === order.id;

              return (
                <Card key={order.id} className="border-border/50">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3">
                      {/* Header row */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-medium">{order.customer_name || 'Unknown'}</span>
                            <span className="text-sm text-muted-foreground">{order.customer_email}</span>
                            <Badge variant="outline" className={statusColors[order.status] || ''}>
                              {order.status}
                            </Badge>
                          </div>
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
                              <Input
                                placeholder="URL (optional)"
                                value={trackingUrl}
                                onChange={(e) => setTrackingUrl(e.target.value)}
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
                                setTrackingUrl(order.tracking_url || '');
                              }}
                            >
                              <Truck className="w-4 h-4 mr-1" />
                              {order.tracking_number ? 'Edit Tracking' : 'Add Tracking'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Order specs summary */}
                      {specs.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {specs.map((spec, i) => (
                            <OrderSpecBadge key={i} label={spec.key} value={spec.value} />
                          ))}
                        </div>
                      )}

                      {/* Expandable full details */}
                      <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : order.id)}>
                        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <Package className="w-3.5 h-3.5" />
                          <span>{isExpanded ? 'Hide' : 'Show'} full order details</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-3 p-3 rounded-lg bg-secondary/20 border border-border/30">
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all font-mono max-h-60 overflow-y-auto">
                              {JSON.stringify(order.order_details, null, 2)}
                            </pre>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
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
