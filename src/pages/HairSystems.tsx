import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ShoppingCart, Package } from "lucide-react";

const HairSystems = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Order Hair System Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <ShoppingCart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Order Hair System</h1>
          </div>
          <div className="glass-card p-6">
            <p className="text-muted-foreground">Order form coming soon.</p>
          </div>
        </section>

        {/* Products Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Package className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Products</h2>
          </div>
          <div className="glass-card p-6">
            <p className="text-muted-foreground">No products available yet.</p>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default HairSystems;
