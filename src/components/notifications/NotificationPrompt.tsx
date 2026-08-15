import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isStandalonePWA, pushSupported, resyncPushSubscription, subscribeToPush } from "@/lib/push";

const SNOOZE_KEY = "pushPromptSnoozedUntil";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export function NotificationPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !pushSupported() || !isStandalonePWA()) return;

    if (Notification.permission === "granted") {
      void resyncPushSubscription();
      return;
    }
    if (Notification.permission === "denied") return;

    const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (Date.now() < snoozedUntil) return;

    const timer = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [user]);

  if (!open) return null;

  const handleAllow = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await subscribeToPush();
      } else {
        localStorage.setItem(SNOOZE_KEY, String(Date.now() + SEVEN_DAYS));
      }
    } catch {
      /* keep the app working even if the subscribe call fails */
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const handleNotNow = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SEVEN_DAYS));
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-fade-up">
      <div className="glass-card mx-auto max-w-md rounded-2xl p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="gold-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Bell className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="font-display text-lg font-semibold">Turn on notifications</h2>
            <p className="text-sm text-muted-foreground">Get updates and messages from Barber Launch.</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={handleAllow} disabled={busy}>
            Allow Notifications
          </Button>
          <Button variant="ghost" onClick={handleNotNow} disabled={busy}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
