import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingCart } from "lucide-react";

const HairSystems = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hair Systems</h1>
          <p className="text-muted-foreground">Order and manage your hair systems</p>
        </div>

        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Available Products</h2>
              <p className="text-muted-foreground">No products available yet.</p>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Your Orders</h2>
              <p className="text-muted-foreground">No orders yet.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default HairSystems;
