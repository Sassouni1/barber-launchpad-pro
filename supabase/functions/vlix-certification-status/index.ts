import { createClient } from "npm:@supabase/supabase-js@2";
import { certificationTrialStatus } from "../_shared/programEnrollment/logic.ts";
import { enrollmentStore } from "../_shared/programEnrollment/server.ts";
import { readStripeEvidenceByPaymentIntent } from "../_shared/hairSystemKit/readStripeEvidence.ts";

// Response: { certified, certifiedAt, programStartedAt, enrollmentOrderId }.
// certifiedAt = earliest issued_at of a hair-system certificate for the
// confirmed Auth email. Enrollment fields come only from stored, server-verified
// GHL program orders that re-verify against current Stripe state; otherwise null.

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
  const normalizedEmail = email.trim();
  const store = enrollmentStore(supabase);
  const stripeSecret = Deno.env.get("HAIR_SYSTEM_STRIPE_SECRET_KEY") || Deno.env.get("STRIPE_SECRET_KEY") || "";
  try {
    const status = await certificationTrialStatus(normalizedEmail, {
      facts: async (value) => {
        const { data, error } = await supabase.rpc("vlix_certification_facts", { p_email: value });
        if (error) {
          console.error("Certification lookup failed", error.code ?? "unknown");
          throw new Error("certification_lookup_failed");
        }
        const row = Array.isArray(data) ? data[0] : data;
        return { confirmed_account: row?.confirmed_account === true, certified: row?.certified === true,
          certified_at: typeof row?.certified_at === "string" ? row.certified_at : null };
      },
      candidates: store.candidates,
      readFresh: (paymentId, orderId) => readStripeEvidenceByPaymentIntent(paymentId, orderId, "", stripeSecret),
      revoke: store.revoke,
    });
    return json(status, 200);
  } catch {
    return json({ error: "Certification lookup unavailable" }, 503);
  }
});
