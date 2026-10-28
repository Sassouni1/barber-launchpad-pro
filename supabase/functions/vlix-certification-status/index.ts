import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function validBridgeSecret(actual: string | null, expected: string): Promise<boolean> {
  if (!actual || !expected || actual.length !== expected.length) return false;
  const encoder = new TextEncoder();
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(actualHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("VLIXTOBARBERLAUNCH") ?? "";
  if (!secret) return json({ error: "Certification bridge unavailable" }, 503);
  if (!(await validBridgeSecret(request.headers.get("x-vlix-certification-secret"), secret))) {
    return json({ error: "Unauthorized" }, 401);
  }

  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (typeof email !== "string" || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return json({ error: "Invalid email" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Certification bridge unavailable" }, 503);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("vlix_has_issued_hair_system_certificate", {
    p_email: email.trim(),
  });
  if (error) {
    console.error("Certification lookup failed", error.code ?? "unknown");
    return json({ error: "Certification lookup unavailable" }, 503);
  }
  return json({ certified: data === true }, 200);
});
