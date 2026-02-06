import { useNavigate } from 'react-router-dom';
import { useUnseenShippedOrders, useDismissTrackingNotification } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Package, X } from 'lucide-react';

export function ShippingNotification() {
  const { data: unseenOrders } = useUnseenShippedOrders();
  const dismiss = useDismissTrackingNotification();
  const navigate = useNavigate();

  if (!unseenOrders?.length) return null;

  return (
    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Package className="w-5 h-5 text-green-500 flex-shrink-0" />
        <span className="text-sm font-medium">
          Your order has been shipped!
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => navigate('/orders')}>
          View Tracking
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => {
            unseenOrders.forEach((o) => dismiss.mutate(o.id));
          }}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
