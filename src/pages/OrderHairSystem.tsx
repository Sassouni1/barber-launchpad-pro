import { useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ShoppingCart } from "lucide-react";

const OrderHairSystem = () => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://link.msgsndr.com/js/form_embed.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Order Hair System</h1>
        </div>
        <div className="glass-card rounded-xl overflow-hidden">
          <img 
            src="https://images.clickfunnels.com/8a/5b8c103a9849d09df3d4b478e1f9f8/IMG_1921.jpg" 
            alt="Hair System" 
            className="w-full h-auto"
          />
        </div>
        <div className="glass-card p-4 rounded-xl" style={{ minHeight: "1400px" }}>
          <iframe
            src="https://api.leadconnectorhq.com/widget/form/DUMrKXsSUz4Q6N59izDU"
            style={{ width: "100%", height: "1345px", border: "none", borderRadius: "3px" }}
            id="inline-DUMrKXsSUz4Q6N59izDU"
            data-layout='{"id":"INLINE"}'
            data-trigger-type="alwaysShow"
            data-trigger-value=""
            data-activation-type="alwaysActivated"
            data-activation-value=""
            data-deactivation-type="neverDeactivate"
            data-deactivation-value=""
            data-form-name="New Checkout"
            data-height="1345"
            data-layout-iframe-id="inline-DUMrKXsSUz4Q6N59izDU"
            data-form-id="DUMrKXsSUz4Q6N59izDU"
            title="New Checkout"
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OrderHairSystem;
