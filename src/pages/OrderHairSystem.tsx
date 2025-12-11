import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ShoppingCart } from "lucide-react";

const OrderHairSystem = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Order Hair System</h1>
        </div>
        <div className="glass-card p-6">
          <p className="text-muted-foreground">Order form coming soon.</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OrderHairSystem;
