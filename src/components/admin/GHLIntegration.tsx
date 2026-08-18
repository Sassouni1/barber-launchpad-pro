import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { openOAuthPopup, PopupBlockedError, PopupClosedError } from "@/lib/oauthPopup";
import {
  GHL_CALLBACK_PATH,
  clearGhlOAuthState,
  createGhlOAuthState,
  peekGhlOAuthState,
} from "@/lib/ghlOAuthState";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Link2, Unlink, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type GhlConfig = {
  redirectUri: string;
  canonicalOrigin: string;
  configured: boolean;
};

async function invokeGhlOAuth(action: string, params: Record<string, string> = {}) {
  const { data, error } = await supabase.functions.invoke("ghl-oauth", {
    body: { action, ...params },
  });
  if (error) {
    const details = (data as { error?: string } | null)?.error;
    throw new Error(details || error.message);
  }
  if ((data as { error?: string })?.error) {
    throw new Error((data as { error: string }).error);
  }
  return data;
}

export function GHLIntegration() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const { data: config } = useQuery<GhlConfig>({
    queryKey: ["ghl-config"],
    queryFn: () => invokeGhlOAuth("getConfig"),
    staleTime: 300000,
  });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["ghl-locations"],
    queryFn: () => invokeGhlOAuth("getConnectedLocations"),
    staleTime: 300000,
  });

  // Surface the result of a same-window (redirect) OAuth return.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ghl") === "connected") {
      toast.success("GoHighLevel connected successfully!");
      queryClient.invalidateQueries({ queryKey: ["ghl-locations"] });
      params.delete("ghl");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`
      );
    }
  }, [queryClient]);

  const disconnectMutation = useMutation({
    mutationFn: (locationId: string) => invokeGhlOAuth("disconnect", { locationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-locations"] });
      toast.success("GHL disconnected");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const originMismatch =
    !!config && config.canonicalOrigin !== window.location.origin;

  const handleConnect = async () => {
    setConnectError(null);
    setConnecting(true);
    let redirected = false;
    try {
      const state = createGhlOAuthState(
        `${window.location.pathname}${window.location.search}`
      );
      const { url } = (await invokeGhlOAuth("getAuthUrl", { state })) as {
        url: string;
      };

      try {
        const result = await openOAuthPopup(url, GHL_CALLBACK_PATH);

        const expected = peekGhlOAuthState();
        if (!expected || !result.state || result.state !== expected) {
          throw new Error(
            "Security check failed (state mismatch). Please try connecting again."
          );
        }
        clearGhlOAuthState();

        const exchanged = (await invokeGhlOAuth("exchangeToken", {
          code: result.code,
        })) as { locationName?: string };

        await queryClient.invalidateQueries({ queryKey: ["ghl-locations"] });
        toast.success(
          `Connected to ${exchanged?.locationName || "GoHighLevel"}!`
        );
      } catch (popupErr) {
        if (popupErr instanceof PopupBlockedError) {
          // Safari / blocked popups: complete the flow in the top-level window.
          redirected = true;
          window.location.assign(url);
          return;
        }
        throw popupErr;
      }
    } catch (err) {
      const message =
        err instanceof PopupClosedError
          ? "The GoHighLevel window was closed before finishing. Nothing was connected — click Connect GHL to try again."
          : err instanceof Error
            ? err.message
            : "Failed to connect GoHighLevel";
      clearGhlOAuthState();
      setConnectError(message);
      toast.error(message);
    } finally {
      if (!redirected) setConnecting(false);
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

      {config && (
        <p className="text-xs text-muted-foreground">
          Required GHL redirect URI:{" "}
          <code className="break-all">{config.redirectUri}</code>
        </p>
      )}

      {originMismatch && !connected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p>
              GoHighLevel only accepts the registered callback origin{" "}
              <code className="break-all">{config?.canonicalOrigin}</code>. You are
              currently on <code className="break-all">{window.location.origin}</code>,
              so the connection can't complete here.
            </p>
            <Button asChild size="sm" variant="secondary">
              <a
                href={`${config?.canonicalOrigin}${window.location.pathname}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open admin on {config?.canonicalOrigin}
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {connectError && !connected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{connectError}</AlertDescription>
        </Alert>
      )}

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
        <Button onClick={handleConnect} disabled={connecting || originMismatch}>
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
