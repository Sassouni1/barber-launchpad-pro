import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useUserOrders } from '@/hooks/useOrders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Package, ExternalLink, Loader2, Scissors } from 'lucide-react';
import { format } from 'date-fns';

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

function getOrderSummary(details: Record<string, any> | null): { label: string; value: string }[] {
  if (!details) return [];
  const items: { label: string; value: string }[] = [];

  const hairColor = details['Hair Color'];
  const laceSkin = details['Lace or Skin'];

  if (laceSkin) items.push({ label: 'Type', value: String(laceSkin) });
  if (hairColor) items.push({ label: 'Hair Color', value: String(hairColor) });

  // Fallback for simpler order structures
  if (!items.length && details.product) {
    items.push({ label: 'Product', value: String(details.product) });
  }

  return items;
}

export default function Orders() {
  const { data: orders, isLoading } = useUserOrders();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Order History & Tracking</h1>
          <p className="text-muted-foreground text-sm mt-1">View your past orders and track shipments</p>
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
            {orders.map((order) => {
              const details = order.order_details as Record<string, any> | null;
              const summaryItems = getOrderSummary(details);

              const displayStatus = getDisplayStatus(order);

              return (
                <Card key={order.id} className="border-border/50">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Scissors className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="font-medium">Hair System Order</span>
                          <Badge variant="outline" className={statusColors[displayStatus] || ''}>
                            {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          Ordered {format(new Date(order.order_date), 'MMMM d, yyyy')}
                        </p>

                        {summaryItems.length > 0 && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                            {summaryItems.map((item, i) => (
                              <span key={i} className="text-sm">
                                <span className="text-muted-foreground">{item.label}:</span>{' '}
                                <span className="text-foreground font-medium">{item.value}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {order.tracking_number && (
                          <p className="text-sm text-muted-foreground">
                            Tracking: {order.tracking_number}
                          </p>
                        )}
                      </div>
                      {order.tracking_number && (
                        <Button
                          size="sm"
                          className="gold-gradient text-primary-foreground font-semibold shadow-md hover:opacity-90 transition-opacity"
                          onClick={() => {
                            const url = order.tracking_url || `https://www.google.com/search?q=${encodeURIComponent(order.tracking_number!)}`;
                            window.open(url, '_blank');
                          }}
                        >
                          Track Package
                        </Button>
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
