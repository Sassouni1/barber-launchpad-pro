// Server-side member gate for paid/member-only edge functions.
// The decision comes only from public.member_content_allowed_for(): a verified
// purchase or admin grant, an admin role, or (temporarily, while the full access
// check is off) an account created before the new-account cutover. Never trusts
// request bodies, browser state or user-editable metadata.
import { createClient } from "npm:@supabase/supabase-js@2";

export type MemberGateResult =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; response: Response };

export async function requireMemberContentAccess(req: Request, cors: Record<string, string>): Promise<MemberGateResult> {
  const deny = (status: number, error: string): MemberGateResult => ({
    ok: false,
    response: new Response(JSON.stringify({ success: false, error }), {
      status,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
    }),
  });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return deny(401, "Authentication required");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return deny(401, "Authentication required");
  const { data: allowed, error: accessError } = await db.rpc("member_content_allowed_for", { _user_id: data.user.id });
  if (accessError) return deny(503, "Access could not be checked");
  if (allowed !== true) return deny(403, "Member access pending");
  return { ok: true, userId: data.user.id, email: data.user.email ?? null };
}
