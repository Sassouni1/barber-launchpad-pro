// TEMPORARY server-side operations helper. Token-guarded, no user data exposed.
// Used to run the real Stripe transfer-path verification and a read-only
// dispatcher dry run without impersonating an admin member. Deleted after use.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = Deno.env.get("AFFILIATE_SETUP_OPS_TOKEN") ?? "";
  if (!token || req.headers.get("x-setup-token") !== token) return json({ error: "Not allowed." }, 401);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid body." }, 400);
  }
  const action = String(body.action ?? "");

  if (action === "verify_platform_transfers") {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ error: "No server-side Stripe key is configured." }, 400);
    const headers = { Authorization: `Bearer ${key}` };
    const [accRes, listRes, balRes] = await Promise.all([
      fetch("https://api.stripe.com/v1/account", { headers }),
      fetch("https://api.stripe.com/v1/accounts?limit=1", { headers }),
      fetch("https://api.stripe.com/v1/balance", { headers }),
    ]);
    const account = await accRes.json().catch(() => ({}));
    const list = await listRes.json().catch(() => ({}));
    const balance = await balRes.json().catch(() => ({}));

    const { data: row } = await db.from("affiliate_settings").select("value").eq("key", "program").maybeSingle();
    const settings = (row?.value ?? {}) as Record<string, unknown>;

    const platformId = String((account as { id?: string })?.id ?? "");
    const isPlatform = listRes.ok && Array.isArray((list as { data?: unknown[] })?.data);
    const connectedCount = Array.isArray((list as { data?: unknown[] })?.data)
      ? (list as { data: unknown[] }).data.length
      : 0;
    const transfersActive =
      (account as { capabilities?: Record<string, string> })?.capabilities?.transfers === "active";
    const availableUsd = Number(
      ((balance as { available?: { currency: string; amount: number }[] })?.available ?? [])
        .find((b) => String(b.currency).toLowerCase() === "usd")?.amount ?? 0,
    );
    const expected = settings.expected_seller_account_id ? String(settings.expected_seller_account_id) : "";
    const sellerMatches = !expected || platformId === expected;
    const verified = isPlatform && connectedCount > 0 && transfersActive && sellerMatches;

    const patch = {
      ...settings,
      platform_transfer_verified: verified,
      platform_transfer_checked_at: new Date().toISOString(),
      ...(body.applyTiming
        ? {
          release_timing: "after_days",
          release_delay_days: 7,
          auto_payouts_enabled: verified,
          scheduler_enabled: verified,
        }
        : {}),
    };
    const { error } = await db.from("affiliate_settings").upsert(
      { key: "program", value: patch },
      { onConflict: "key" },
    );
    if (error) return json({ error: error.message }, 500);

    return json({
      verified,
      platformId,
      isPlatform,
      connectedCount,
      transfersActive,
      availableUsdCents: availableUsd,
      sellerMatches,
      settings: patch,
    });
  }

  if (action === "dispatch_dryrun") {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/affiliate-transfer-dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ dryRun: true, source: body.source ?? "manual" }),
    });
    return json({ status: res.status, body: await res.json().catch(() => null) });
  }

  return json({ error: "Unknown action." }, 400);
});
