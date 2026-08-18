import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { consumeGhlOAuthState } from "@/lib/ghlOAuthState";

type Status = "working" | "success" | "error";

export default function GHLCallback() {
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("Connecting to GoHighLevel...");
  const [returnPath, setReturnPath] = useState("/admin");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || undefined;
    const state = params.get("state") || undefined;
    const oauthError =
      params.get("error_description") || params.get("error") || undefined;
    const callbackPath = window.location.pathname;

    const opener = window.opener && window.opener !== window ? window.opener : null;

    // Popup path: hand the code back to the opener, which owns the exchange.
    if (opener) {
      const payload = {
        type: "oauth-callback",
        callbackPath,
        code,
        state,
        error: oauthError,
      };
      opener.postMessage(payload, window.location.origin);
      const retry = window.setInterval(() => {
        opener.postMessage(payload, window.location.origin);
      }, 300);
      const closeTimer = window.setTimeout(() => {
        window.clearInterval(retry);
        window.close();
      }, 1500);
      return () => {
        window.clearInterval(retry);
        window.clearTimeout(closeTimer);
      };
    }

    // Same-window (Safari-safe) path: validate state and exchange here.
    const stored = consumeGhlOAuthState();
    setReturnPath(stored.returnPath);

    const run = async () => {
      if (oauthError) {
        if (!cancelled) {
          setStatus("error");
          setMessage(oauthError);
        }
        return;
      }
      if (!code) {
        if (!cancelled) {
          setStatus("error");
          setMessage("GoHighLevel did not return an authorization code.");
        }
        return;
      }
      if (!stored.state || !state || stored.state !== state) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            "Security check failed (state mismatch or expired). Please start the connection again from the admin page."
          );
        }
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            "Your admin session expired during the GoHighLevel login. Sign in again and retry the connection."
          );
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke("ghl-oauth", {
        body: { action: "exchangeToken", code },
      });

      if (cancelled) return;

      if (error || (data as { error?: string })?.error) {
        setStatus("error");
        setMessage(
          (data as { error?: string })?.error ||
            error?.message ||
            "Failed to complete the GoHighLevel connection."
        );
        return;
      }

      setStatus("success");
      setMessage(
        `Connected to ${(data as { locationName?: string })?.locationName || "GoHighLevel"}.`
      );
      window.setTimeout(() => {
        window.location.replace(`${stored.returnPath}?ghl=connected`);
      }, 1200);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4 max-w-md">
        {status === "working" && (
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        )}
        {status === "success" && (
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
        )}
        {status === "error" && (
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
        )}
        <p className="text-muted-foreground">{message}</p>
        {status === "error" && (
          <Button onClick={() => window.location.replace(returnPath)}>
            Back to admin
          </Button>
        )}
      </div>
    </div>
  );
}
