import { supabase } from "@/integrations/supabase/client";

export type AccessEventType =
  | "login"
  | "logout"
  | "session_start"
  | "page_view"
  | "lesson_view"
  | "video_play"
  | "video_complete"
  | "file_download"
  | "lesson_complete"
  | "quiz_submit"
  | "homework_submit"
  | "certificate_view"
  | "marketing_image_generate";

interface LogAccessParams {
  event_type: AccessEventType | string;
  resource_type?: string;
  resource_id?: string;
  route?: string;
  metadata?: Record<string, unknown>;
}

// Per-tab session id so we can group activity into a single visit
let sessionId: string | null = null;
function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    const existing = sessionStorage.getItem("access_log_session_id");
    if (existing) {
      sessionId = existing;
      return existing;
    }
    const fresh = crypto.randomUUID();
    sessionStorage.setItem("access_log_session_id", fresh);
    sessionId = fresh;
    return fresh;
  } catch {
    sessionId = crypto.randomUUID();
    return sessionId;
  }
}

/**
 * Fire-and-forget access logger. Captures IP + user agent server-side
 * so the log is dispute-grade evidence (Stripe, chargebacks).
 */
export async function logAccess(params: LogAccessParams): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return; // only log authenticated activity

    await supabase.functions.invoke("log-access", {
      body: {
        event_type: params.event_type,
        resource_type: params.resource_type,
        resource_id: params.resource_id,
        route: params.route ?? (typeof window !== "undefined" ? window.location.pathname : null),
        session_id: getSessionId(),
        metadata: params.metadata ?? {},
      },
    });
  } catch (e) {
    // Never let logging break the UI
    console.warn("[accessLog] failed", e);
  }
}
