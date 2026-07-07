import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ShoppingCart, Play } from "lucide-react";
import { Link } from "react-router-dom";
import hairColors from "@/assets/hair-colors.jpg";
import hairCurls from "@/assets/hair-curls.jpg";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const OrderHairSystem = () => {
  const { user } = useAuth();
  const formBaseUrl = "https://api.leadconnectorhq.com/widget/form/kROgKLSgoXtm6IHCaaq5";
  const formUrl = user ? `${formBaseUrl}?user_id=${user.id}` : formBaseUrl;

  // Load GHL iframe resizer so the form auto-sizes to its content
  // and does not show nested scrollbars.
  useEffect(() => {
    const scriptId = "ghl-form-embed-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://link.msgsndr.com/js/form_embed.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

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
        <div className="bg-card/90 border border-border/50 rounded-xl overflow-hidden">
          <iframe
            src={formUrl}
            style={{ width: "100%", height: "100%", minHeight: "2391px", border: "none", borderRadius: "8px", display: "block" }}
            id="inline-kROgKLSgoXtm6IHCaaq5"
            allow="payment *; publickey-credentials-get *"
            allowFullScreen
            data-layout='{"id":"INLINE"}'
            data-trigger-type="alwaysShow"
            data-trigger-value=""
            data-activation-type="alwaysActivated"
            data-activation-value=""
            data-deactivation-type="neverDeactivate"
            data-deactivation-value=""
            data-form-name="Form 28"
            data-height="2391"
            data-layout-iframe-id="inline-kROgKLSgoXtm6IHCaaq5"
            data-form-id="kROgKLSgoXtm6IHCaaq5"
            title="Form 28"
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OrderHairSystem;
