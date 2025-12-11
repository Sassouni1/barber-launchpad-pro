import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Package } from "lucide-react";

const Products = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
        </div>
        <div className="glass-card p-6">
          <p className="text-muted-foreground">No products available yet.</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Products;
