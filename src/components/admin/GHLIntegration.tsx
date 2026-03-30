import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { openOAuthPopup } from "@/lib/oauthPopup";
import { Button } from "@/components/ui/button";
import { Loader2, Link2, Unlink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const CALLBACK_PATH = "/integrations/ghl/callback";

function getRedirectUri() {
  return `https://barber-launchpad-pro.lovable.app${CALLBACK_PATH}`;
}

async function invokeGhlOAuth(action: string, params: Record<string, string> = {}) {
  const { data, error } = await supabase.functions.invoke("ghl-oauth", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

export function GHLIntegration() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["ghl-locations"],
    queryFn: () => invokeGhlOAuth("getConnectedLocations"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (locationId: string) =>
      invokeGhlOAuth("disconnect", { locationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-locations"] });
      toast.success("GHL disconnected");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const redirectUri = getRedirectUri();

      // Get the OAuth URL
      const { url } = await invokeGhlOAuth("getAuthUrl", { redirectUri });

      // Open popup and wait for code
      const { code } = await openOAuthPopup(url, CALLBACK_PATH);

      // Exchange code for tokens
      await invokeGhlOAuth("exchangeToken", { code, redirectUri });

      queryClient.invalidateQueries({ queryKey: ["ghl-locations"] });
      toast.success("GHL connected successfully!");
    } catch (err: any) {
      if (err.message !== "OAuth window was closed") {
        toast.error(err.message || "Failed to connect GHL");
      }
    } finally {
      setConnecting(false);
    }
  };

  const connected = locations.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-base">GoHighLevel</h3>
          <p className="text-sm text-muted-foreground">
            {connected
              ? "Connected — SMS reminders will use this connection."
              : "Connect your GHL account to enable automated SMS reminders."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : connected ? (
        <div className="space-y-3">
          {locations.map((loc: any) => (
            <div
              key={loc.location_id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="font-medium">{loc.location_name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnectMutation.mutate(loc.location_id)}
                disabled={disconnectMutation.isPending}
              >
                <Unlink className="w-4 h-4 mr-1" />
                Disconnect
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <Button onClick={handleConnect} disabled={connecting}>
          {connecting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Link2 className="w-4 h-4 mr-2" />
          )}
          Connect GHL
        </Button>
      )}
    </div>
  );
}
