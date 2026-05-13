import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function GHLCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || undefined;
    const error = params.get("error_description") || params.get("error") || undefined;
    const callbackPath = window.location.pathname;
    const opener = window.opener;

    if (!opener) return;

    const payload = {
      type: "oauth-callback",
      callbackPath,
      code,
      error,
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
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Connecting to GoHighLevel...</p>
        <p className="text-xs text-muted-foreground">This window will close automatically.</p>
      </div>
    </div>
  );
}
