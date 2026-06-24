// Barber Launch Pro — Stripe Connect + Payment Links backend
// Actions: getStatus | startOnboarding | syncPaymentLinks
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_API = "https://api.stripe.com/v1";

const PRESET_LINKS: Array<{
  template_key: string;
  display_name: string;
  amount_cents: number;
}> = [
  { template_key: "down_deposit_350", display_name: "Down Deposit", amount_cents: 35000 },
  { template_key: "hold_spot_100", display_name: "Hold Spot", amount_cents: 10000 },
  { template_key: "hair_system_install_400", display_name: "Hair System Install — $400", amount_cents: 40000 },
  { template_key: "hair_system_install_600", display_name: "Hair System Install — $600", amount_cents: 60000 },
  { template_key: "hair_system_install_800", display_name: "Hair System Install — $800", amount_cents: 80000 },
  { template_key: "hair_system_install_1000", display_name: "Hair System Install — $1,000", amount_cents: 100000 },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formEncode(
  params: Record<string, string | number | boolean | string[] | undefined | null>,
): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      v.forEach((val, idx) =>
        out.push(`${encodeURIComponent(`${k}[${idx}]`)}=${encodeURIComponent(String(val))}`)
      );
    } else {
      out.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out.join("&");
}

async function stripeFetch(
  path: string,
  opts: {
    method?: string;
    body?: Record<string, unknown>;
    stripeAccount?: string;
    secret: string;
  },
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.secret}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (opts.stripeAccount) headers["Stripe-Account"] = opts.stripeAccount;
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body ? formEncode(opts.body as Record<string, string>) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.message || `Stripe error ${res.status}`;
    throw new Error(message);
  }
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return jsonResponse(
        { error: "STRIPE_SECRET_KEY is not configured on the server." },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;
    const userEmail = (claimsData.claims.email as string) || undefined;

    const admin = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }
    const action = body?.action as string | undefined;
    if (!action) return jsonResponse({ error: "Missing action" }, 400);

    const { data: existingAccount } = await admin
      .from("barber_launch_stripe_accounts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (action === "getStatus") {
      let account = existingAccount;
      if (account?.stripe_account_id) {
        try {
          const acct = await stripeFetch(`/accounts/${account.stripe_account_id}`, {
            method: "GET",
            secret: stripeSecret,
          });
          const updates = {
            charges_enabled: !!acct.charges_enabled,
            payouts_enabled: !!acct.payouts_enabled,
            details_submitted: !!acct.details_submitted,
            synced_at: new Date().toISOString(),
          };
          await admin
            .from("barber_launch_stripe_accounts")
            .update(updates)
            .eq("id", account.id);
          account = { ...account, ...updates };
        } catch (e) {
          console.error("Failed to refresh Stripe account", e);
        }
      }

      const { data: links } = await admin
        .from("barber_launch_payment_links")
        .select("*")
        .eq("user_id", userId)
        .order("amount_cents", { ascending: true });

      return jsonResponse({ account: account ?? null, links: links ?? [] });
    }

    if (action === "startOnboarding") {
      let accountId = existingAccount?.stripe_account_id;
      if (!accountId) {
        const acct = await stripeFetch("/accounts", {
          secret: stripeSecret,
          body: {
            type: "express",
            email: userEmail,
            "capabilities[card_payments][requested]": "true",
            "capabilities[transfers][requested]": "true",
            "capabilities[klarna_payments][requested]": "true",
            "business_type": "individual",
            "metadata[user_id]": userId,
            "metadata[app]": "barber_launch_pro",
          },
        });
        accountId = acct.id;
        await admin.from("barber_launch_stripe_accounts").insert({
          user_id: userId,
          stripe_account_id: accountId,
          charges_enabled: !!acct.charges_enabled,
          payouts_enabled: !!acct.payouts_enabled,
          details_submitted: !!acct.details_submitted,
          onboarding_started_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        });
      } else {
        await admin
          .from("barber_launch_stripe_accounts")
          .update({ onboarding_started_at: new Date().toISOString() })
          .eq("user_id", userId);
      }

      const origin = req.headers.get("origin") || body.returnOrigin || "";
      const returnUrl = `${origin}/my-links?stripe=return`;
      const refreshUrl = `${origin}/my-links?stripe=refresh`;

      const link = await stripeFetch("/account_links", {
        secret: stripeSecret,
        body: {
          account: accountId!,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: "account_onboarding",
        },
      });

      return jsonResponse({ url: link.url, accountId });
    }

    if (action === "syncPaymentLinks") {
      if (!existingAccount?.stripe_account_id) {
        return jsonResponse(
          { error: "No connected Stripe account. Complete onboarding first." },
          400,
        );
      }
      const accountId = existingAccount.stripe_account_id;

      // Refresh account state to ensure charges enabled
      const acct = await stripeFetch(`/accounts/${accountId}`, {
        method: "GET",
        secret: stripeSecret,
      });
      if (!acct.charges_enabled) {
        return jsonResponse(
          {
            error:
              "Your Stripe account is not ready to accept charges yet. Finish onboarding in Stripe.",
          },
          400,
        );
      }

      const { data: existingLinks } = await admin
        .from("barber_launch_payment_links")
        .select("template_key")
        .eq("user_id", userId);
      const have = new Set((existingLinks ?? []).map((l) => l.template_key));

      const created: any[] = [];
      for (const preset of PRESET_LINKS) {
        if (have.has(preset.template_key)) continue;

        const product = await stripeFetch("/products", {
          secret: stripeSecret,
          stripeAccount: accountId,
          body: {
            name: preset.display_name,
            "metadata[user_id]": userId,
            "metadata[template_key]": preset.template_key,
            "metadata[app]": "barber_launch_pro",
          },
        });

        const price = await stripeFetch("/prices", {
          secret: stripeSecret,
          stripeAccount: accountId,
          body: {
            product: product.id,
            unit_amount: preset.amount_cents,
            currency: "usd",
          },
        });

        const link = await stripeFetch("/payment_links", {
          secret: stripeSecret,
          stripeAccount: accountId,
          body: {
            "line_items[0][price]": price.id,
            "line_items[0][quantity]": 1,
            "payment_method_types[0]": "card",
            "payment_method_types[1]": "klarna",
            "phone_number_collection[enabled]": "true",
            "metadata[user_id]": userId,
            "metadata[template_key]": preset.template_key,
            "metadata[app]": "barber_launch_pro",
          },
        });

        const { data: inserted } = await admin
          .from("barber_launch_payment_links")
          .insert({
            user_id: userId,
            stripe_account_id: accountId,
            template_key: preset.template_key,
            display_name: preset.display_name,
            amount_cents: preset.amount_cents,
            currency: "usd",
            stripe_product_id: product.id,
            stripe_price_id: price.id,
            stripe_payment_link_id: link.id,
            url: link.url,
            active: true,
            payment_method_types: ["card", "klarna"],
          })
          .select()
          .single();

        if (inserted) created.push(inserted);
      }

      const { data: links } = await admin
        .from("barber_launch_payment_links")
        .select("*")
        .eq("user_id", userId)
        .order("amount_cents", { ascending: true });

      return jsonResponse({ created: created.length, links: links ?? [] });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("barber-launch-stripe error", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return jsonResponse({ error: message }, 500);
  }
});
