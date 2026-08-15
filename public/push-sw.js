/* Barber Launch push messaging service worker.
   Handles web push only — it is not an app-shell cache. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { title: "Barber Launch", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Barber Launch";
  const options = {
    body: payload.body || "",
    icon: "/icons/barber-launch-192.png",
    badge: "/icons/barber-launch-192.png",
    silent: false,
    requireInteraction: false,
    tag: payload.tag || undefined,
    data: { url: typeof payload.url === "string" && payload.url.startsWith("/") ? payload.url : "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = (event.notification.data && event.notification.data.url) || "/";
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch (_e) {
              /* ignore navigation failures */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
