export function openOAuthPopup(url: string, callbackPath: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      "ghl-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
      reject(new Error("Popup blocked. Please allow popups for this site."));
      return;
    }

    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          reject(new Error("OAuth window was closed"));
          return;
        }

        const popupUrl = popup.location.href;
        if (popupUrl && popupUrl.includes(callbackPath)) {
          const url = new URL(popupUrl);
          const code = url.searchParams.get("code");

          clearInterval(interval);
          popup.close();

          if (code) {
            resolve({ code });
          } else {
            reject(new Error("No authorization code received"));
          }
        }
      } catch {
        // Cross-origin — ignore until redirect back
      }
    }, 400);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      if (!popup.closed) popup.close();
      reject(new Error("OAuth timed out"));
    }, 300000);
  });
}
