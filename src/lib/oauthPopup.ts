export type OAuthPopupResult = { code: string; state?: string };

export class PopupBlockedError extends Error {
  constructor() {
    super("Popup blocked");
    this.name = "PopupBlockedError";
  }
}

export class PopupClosedError extends Error {
  constructor() {
    super("The GoHighLevel window was closed before the connection finished.");
    this.name = "PopupClosedError";
  }
}

/**
 * Opens an OAuth popup and resolves with the authorization code once the
 * callback page posts it back. Rejects with PopupBlockedError immediately when
 * the browser refuses to open the window so the caller can fall back to a
 * top-level redirect (required for Safari).
 */
export function openOAuthPopup(
  url: string,
  callbackPath: string
): Promise<OAuthPopupResult> {
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const popup = window.open(
    url,
    "ghl-oauth",
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
  );

  if (!popup || popup.closed || typeof popup.closed === "undefined") {
    return Promise.reject(new PopupBlockedError());
  }

  return new Promise<OAuthPopupResult>((resolve, reject) => {
    let settled = false;
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
        state?: string;
        error?: string;
      };

      if (data?.type !== "oauth-callback" || data.callbackPath !== callbackPath) return;

      finish(() => {
        if (!popup.closed) popup.close();
        if (data.code) {
          resolve({ code: data.code, state: data.state });
        } else {
          reject(new Error(data.error || "No authorization code received"));
        }
      });
    };

    window.addEventListener("message", handleMessage);

    interval = setInterval(() => {
      try {
        if (popup.closed) {
          finish(() => reject(new PopupClosedError()));
          return;
        }

        const popupUrl = popup.location.href;
        if (popupUrl && popupUrl.includes(callbackPath)) {
          const parsed = new URL(popupUrl);
          const code = parsed.searchParams.get("code");
          const state = parsed.searchParams.get("state") || undefined;

          finish(() => {
            if (!popup.closed) popup.close();
            if (code) {
              resolve({ code, state });
            } else {
              reject(new Error("No authorization code received"));
            }
          });
        }
      } catch {
        // Cross-origin while on the GHL domain — ignore until redirect back.
      }
    }, 400);

    timeout = setTimeout(() => {
      finish(() => {
        if (!popup.closed) popup.close();
        reject(new Error("The GoHighLevel connection timed out. Please try again."));
      });
    }, 300000);
  });
}
