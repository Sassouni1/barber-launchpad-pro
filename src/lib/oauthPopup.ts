export function openOAuthPopup(url: string, callbackPath: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    let settled = false;

    const popup = window.open(
      url,
      "ghl-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
      reject(new Error("Popup blocked. Please allow popups for this site."));
      return;
    }

    let interval: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearInterval(interval);
      clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
      callback();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data as {
        type?: string;
        callbackPath?: string;
        code?: string;
        error?: string;
      };

      if (data?.type !== "oauth-callback" || data.callbackPath !== callbackPath) return;

      finish(() => {
        if (!popup.closed) popup.close();
        if (data.code) {
          resolve({ code: data.code });
        } else {
          reject(new Error(data.error || "No authorization code received"));
        }
      });
    };

    window.addEventListener("message", handleMessage);

    interval = setInterval(() => {
      try {
        if (popup.closed) {
          finish(() => reject(new Error("OAuth window was closed")));
          return;
        }

        const popupUrl = popup.location.href;
        if (popupUrl && popupUrl.includes(callbackPath)) {
          const url = new URL(popupUrl);
          const code = url.searchParams.get("code");

          finish(() => {
            if (!popup.closed) popup.close();
            if (code) {
              resolve({ code });
            } else {
              reject(new Error("No authorization code received"));
            }
          });
        }
      } catch {
        // Cross-origin — ignore until redirect back
      }
    }, 400);

    // Timeout after 5 minutes
    timeout = setTimeout(() => {
      finish(() => {
        if (!popup.closed) popup.close();
        reject(new Error("OAuth timed out"));
      });
    }, 300000);
  });
}
