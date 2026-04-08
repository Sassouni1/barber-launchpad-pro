import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ShoppingCart, Play } from "lucide-react";
import { Link } from "react-router-dom";
import hairColors from "@/assets/hair-colors.jpg";
import hairCurls from "@/assets/hair-curls.jpg";
import { useAuth } from "@/hooks/useAuth";

const OrderHairSystem = () => {
  const { user } = useAuth();
  const formBaseUrl = "https://api.leadconnectorhq.com/widget/form/DUMrKXsSUz4Q6N59izDU";
  const formUrl = user ? `${formBaseUrl}?user_id=${user.id}` : formBaseUrl;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Order Hair System</h1>
        </div>
        <Link
          to="/courses/hair-system/lesson/60c268c9-5df7-4161-8d91-2c185fc791d0"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-5 py-3 transition-colors font-medium text-sm"
        >
          <Play className="h-4 w-4 fill-primary-foreground" />
          Watch Video: Placing a Hair System Order
        </Link>
        <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
          <div className="glass-card rounded-lg overflow-hidden">
            <img 
              src={hairColors}
              alt="Hair System Colors" 
              className="w-full h-auto"
            />
          </div>
          <div className="glass-card rounded-lg overflow-hidden">
            <img 
              src={hairCurls}
              alt="Hair System Curls" 
              className="w-full h-auto"
            />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground">Place Order:</h2>
        <div className="bg-card/90 border border-border/50 p-4 rounded-xl" style={{ minHeight: "1400px" }}>
          <iframe
            src={formUrl}
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
