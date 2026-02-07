import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Package, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Product {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  button_text: string | null;
  image_position_x: number | null;
  image_position_y: number | null;
}

const Products = () => {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as Product[];
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
        </div>
        <div className="glass-card p-6">
          {isLoading ? (
            <p className="text-muted-foreground">Loading products...</p>
          ) : products.length === 0 ? (
            <p className="text-muted-foreground">No products available yet.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <div key={product.id} className="border border-border rounded-lg overflow-hidden bg-card">
                    {product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="w-full aspect-square object-cover"
                      style={{ objectPosition: `${product.image_position_x ?? 50}% ${product.image_position_y ?? 50}%` }}
                    />
                  )}
                  <div className="p-4 space-y-3">
                    <h3 className="font-semibold text-foreground text-lg">{product.title}</h3>
                    {product.description && (
                      <p className="text-sm text-muted-foreground">{product.description}</p>
                    )}
                    {product.link_url && (
                      <Button asChild className="w-full gap-2">
                        <a href={product.link_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          {product.button_text || "View Product"}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Products;
