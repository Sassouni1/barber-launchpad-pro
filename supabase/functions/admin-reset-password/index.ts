import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  const { user_id, password } = await req.json();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.auth.admin.updateUserById(user_id, { password });
  return new Response(JSON.stringify({ ok: !error, error: error?.message, user: data?.user?.email }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
});
