import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAllOrders, useUpdateTracking } from '@/hooks/useOrders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Truck, Check } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  processing: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  shipped: 'bg-green-500/10 text-green-500 border-green-500/30',
  delivered: 'bg-primary/10 text-primary border-primary/30',
};

export default function ManufacturerOrders() {
  const { data: orders, isLoading } = useAllOrders();
  const updateTracking = useUpdateTracking();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

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
          <p className="text-muted-foreground text-sm mt-1">Add tracking numbers to orders</p>
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
            {orders.map((order) => (
              <Card key={order.id} className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

                    <div className="flex-shrink-0">
                      {editingId === order.id ? (
                        <div className="flex items-center gap-2">
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
