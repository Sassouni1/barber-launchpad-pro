import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { logAccess } from "@/lib/accessLog";

/**
 * Mounts inside the Router and logs every authenticated page view,
 * plus a single "session_start" event each time a user signs in
 * (per browser tab session).
 */
export function AccessLogger() {
  const { user } = useAuthContext();
  const location = useLocation();
  const sessionLoggedFor = useRef<string | null>(null);
  const lastRouteLogged = useRef<string | null>(null);

  // session_start once per user per tab
  useEffect(() => {
    if (!user) {
      sessionLoggedFor.current = null;
      return;
    }
    if (sessionLoggedFor.current === user.id) return;
    sessionLoggedFor.current = user.id;

    // Rich client-side fingerprint — strengthens dispute evidence
    const fp: Record<string, unknown> = { email: user.email };
    try {
      fp.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      fp.locale = navigator.language;
      fp.languages = navigator.languages?.slice(0, 3);
      fp.platform = (navigator as any).userAgentData?.platform || navigator.platform;
      fp.screen = `${window.screen.width}x${window.screen.height}`;
      fp.viewport = `${window.innerWidth}x${window.innerHeight}`;
      fp.dpr = window.devicePixelRatio;
      fp.color_depth = window.screen.colorDepth;
      fp.hardware_concurrency = navigator.hardwareConcurrency;
      fp.touch_points = navigator.maxTouchPoints;
      fp.online = navigator.onLine;
      fp.cookies_enabled = navigator.cookieEnabled;
    } catch {}

    logAccess({
      event_type: "session_start",
      route: location.pathname,
      metadata: fp,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // page_view on every route change
  useEffect(() => {
    if (!user) return;
    const route = location.pathname + location.search;
    if (lastRouteLogged.current === route) return;
    lastRouteLogged.current = route;
    logAccess({ event_type: "page_view", route });
  }, [location.pathname, location.search, user]);

  return null;
}
