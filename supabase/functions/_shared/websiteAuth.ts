import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Validates the bearer token in-code (verify_jwt is disabled for these functions). */
export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { user: null, error: "Missing authorization header" };

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return { user: null, error: "Invalid or expired session" };
  return { user: data.user, error: null };
}

export function slugify(input: string, fallback: string) {
  const base = (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length >= 2 ? base : fallback;
}
