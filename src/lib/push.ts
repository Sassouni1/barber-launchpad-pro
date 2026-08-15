import { supabase } from "@/integrations/supabase/client";

const SW_PATH = "/push-sw.js";

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output.buffer;
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_PATH);
  } catch {
    return null;
  }
}

/** Subscribes this device and stores the subscription for the signed-in member. */
export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported()) return false;

  const registration = await registerPushServiceWorker();
  if (!registration) return false;
  await navigator.serviceWorker.ready;

  const { data: keyData, error: keyError } = await supabase.functions.invoke("push-subscribe", {
    body: { action: "public-key" },
  });
  const publicKey = (keyData as { publicKey?: string } | null)?.publicKey;
  if (keyError || !publicKey) return false;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const { error } = await supabase.functions.invoke("push-subscribe", {
    body: {
      action: "subscribe",
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    },
  });

  return !error;
}

/** Re-syncs an existing device subscription when permission is already granted. */
export async function resyncPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    await subscribeToPush();
  } catch {
    /* notifications must never break the app */
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.functions.invoke("push-subscribe", {
    body: { action: "unsubscribe", endpoint: subscription.endpoint },
  });
  await subscription.unsubscribe();
}
