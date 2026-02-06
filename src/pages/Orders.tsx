import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useUserOrders } from '@/hooks/useOrders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Package, ExternalLink, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  processing: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  shipped: 'bg-green-500/10 text-green-500 border-green-500/30',
  delivered: 'bg-primary/10 text-primary border-primary/30',
};

export default function Orders() {
  const { data: orders, isLoading } = useUserOrders();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">My Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your hair system orders</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !orders?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium">
                          {format(new Date(order.order_date), 'MMM d, yyyy')}
                        </span>
                        <Badge variant="outline" className={statusColors[order.status] || ''}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                      </div>
                      {order.tracking_number && (
                        <p className="text-sm text-muted-foreground">
                          Tracking: {order.tracking_number}
                        </p>
                      )}
                    </div>
                    {order.tracking_number && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const url = order.tracking_url || `https://www.google.com/search?q=${encodeURIComponent(order.tracking_number!)}`;
                          window.open(url, '_blank');
                        }}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Track
                      </Button>
                    )}
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
