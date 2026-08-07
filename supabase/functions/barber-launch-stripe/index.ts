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

// Collect full customer details on every checkout:
// name + full billing address (billing_address_collection), phone number,
// and explicit first/last name custom fields.
function collectionFields(collectPhone = true): Record<string, unknown> {
  return {
    billing_address_collection: "required",
    "phone_number_collection[enabled]": collectPhone ? "true" : "false",
    "custom_fields[0][key]": "first_name",
    "custom_fields[0][label][type]": "custom",
    "custom_fields[0][label][custom]": "First name",
    "custom_fields[0][type]": "text",
    "custom_fields[0][text][maximum_length]": 60,
    "custom_fields[1][key]": "last_name",
    "custom_fields[1][label][type]": "custom",
    "custom_fields[1][label][custom]": "Last name",
    "custom_fields[1][type]": "text",
    "custom_fields[1][text][maximum_length]": 60,
  };
}

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
            type: "standard",
            email: userEmail,
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
            ...collectionFields(true),
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

      // Backfill: make sure every existing link collects name, phone and address.
      const { data: allLinks } = await admin
        .from("barber_launch_payment_links")
        .select("stripe_payment_link_id")
        .eq("user_id", userId)
        .eq("active", true);
      for (const l of allLinks ?? []) {
        if (!l.stripe_payment_link_id) continue;
        try {
          await stripeFetch(`/payment_links/${l.stripe_payment_link_id}`, {
            secret: stripeSecret,
            stripeAccount: accountId,
            body: collectionFields(true),
          });
        } catch (e) {
          console.error("Could not upgrade link", l.stripe_payment_link_id, e);
        }
      }



      const { data: links } = await admin
        .from("barber_launch_payment_links")
        .select("*")
        .eq("user_id", userId)
        .order("amount_cents", { ascending: true });

      return jsonResponse({ created: created.length, links: links ?? [] });
    }

    if (action === "createCustomLink") {
      if (!existingAccount?.stripe_account_id) {
        return jsonResponse(
          { error: "No connected Stripe account. Complete onboarding first." },
          400,
        );
      }
      const accountId = existingAccount.stripe_account_id;

      const name = String(body?.name ?? "").trim();
      const amountCents = Math.round(Number(body?.amountCents));
      const allowKlarna = body?.allowKlarna !== false;
      const collectPhone = body?.collectPhone !== false;

      if (!name || name.length > 120) {
        return jsonResponse({ error: "Enter a name (1-120 characters)." }, 400);
      }
      if (!Number.isFinite(amountCents) || amountCents < 100 || amountCents > 5000000) {
        return jsonResponse({ error: "Enter an amount between $1 and $50,000." }, 400);
      }

      const acct = await stripeFetch(`/accounts/${accountId}`, {
        method: "GET",
        secret: stripeSecret,
      });
      if (!acct.charges_enabled) {
        return jsonResponse(
          { error: "Your Stripe account is not ready to accept charges yet." },
          400,
        );
      }

      const methods = allowKlarna ? ["card", "klarna"] : ["card"];
      const templateKey = `custom_${Date.now()}`;

      const product = await stripeFetch("/products", {
        secret: stripeSecret,
        stripeAccount: accountId,
        body: {
          name,
          "metadata[user_id]": userId,
          "metadata[template_key]": templateKey,
          "metadata[app]": "barber_launch_pro",
        },
      });

      const price = await stripeFetch("/prices", {
        secret: stripeSecret,
        stripeAccount: accountId,
        body: { product: product.id, unit_amount: amountCents, currency: "usd" },
      });

      const linkBody: Record<string, unknown> = {
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": 1,
        "phone_number_collection[enabled]": collectPhone ? "true" : "false",
        "metadata[user_id]": userId,
        "metadata[template_key]": templateKey,
        "metadata[app]": "barber_launch_pro",
      };
      methods.forEach((m, i) => {
        linkBody[`payment_method_types[${i}]`] = m;
      });

      const link = await stripeFetch("/payment_links", {
        secret: stripeSecret,
        stripeAccount: accountId,
        body: linkBody,
      });

      await admin.from("barber_launch_payment_links").insert({
        user_id: userId,
        stripe_account_id: accountId,
        template_key: templateKey,
        display_name: name,
        amount_cents: amountCents,
        currency: "usd",
        stripe_product_id: product.id,
        stripe_price_id: price.id,
        stripe_payment_link_id: link.id,
        url: link.url,
        active: true,
        payment_method_types: methods,
      });

      const { data: links } = await admin
        .from("barber_launch_payment_links")
        .select("*")
        .eq("user_id", userId)
        .order("amount_cents", { ascending: true });

      return jsonResponse({ links: links ?? [] });
    }

    if (action === "getEarnings") {
      if (!existingAccount?.stripe_account_id) {
        return jsonResponse({ error: "No connected Stripe account." }, 400);
      }
      const accountId = existingAccount.stripe_account_id;

      const balance = await stripeFetch("/balance", {
        method: "GET",
        secret: stripeSecret,
        stripeAccount: accountId,
      });

      const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
      const charges = await stripeFetch(
        `/charges?limit=100&created[gte]=${since}`,
        { method: "GET", secret: stripeSecret, stripeAccount: accountId },
      );

      const succeeded = (charges.data ?? []).filter(
        (c: any) => c.status === "succeeded",
      );

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayTs = Math.floor(startOfToday.getTime() / 1000);
      const weekTs = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7;

      const sum = (list: any[]) =>
        list.reduce((t, c) => t + (c.amount - (c.amount_refunded ?? 0)), 0);

      const todayCharges = succeeded.filter((c: any) => c.created >= todayTs);

      return jsonResponse({
        currency: balance?.available?.[0]?.currency ?? "usd",
        available: (balance?.available ?? []).reduce(
          (t: number, b: any) => t + b.amount,
          0,
        ),
        pending: (balance?.pending ?? []).reduce(
          (t: number, b: any) => t + b.amount,
          0,
        ),
        today: sum(todayCharges),
        todayCount: todayCharges.length,
        last7: sum(succeeded.filter((c: any) => c.created >= weekTs)),
        last30: sum(succeeded),
        last30Count: succeeded.length,
        recent: succeeded.slice(0, 15).map((c: any) => ({
          id: c.id,
          amount: c.amount,
          amountRefunded: c.amount_refunded ?? 0,
          refunded: !!c.refunded,
          currency: c.currency,
          created: c.created,
          description: c.description ?? c.calculated_statement_descriptor ?? null,
          customerName: c.billing_details?.name ?? null,
          customerEmail: c.billing_details?.email ?? c.receipt_email ?? null,
        })),
      });
    }

    if (action === "refundCharge") {
      if (!existingAccount?.stripe_account_id) {
        return jsonResponse({ error: "No connected Stripe account." }, 400);
      }
      const accountId = existingAccount.stripe_account_id;

      const chargeId = String(body?.chargeId ?? "").trim();
      if (!/^(ch|py)_[A-Za-z0-9_]+$/.test(chargeId)) {
        return jsonResponse({ error: "Invalid charge id." }, 400);
      }

      const charge = await stripeFetch(`/charges/${chargeId}`, {
        method: "GET",
        secret: stripeSecret,
        stripeAccount: accountId,
      });
      if (charge.status !== "succeeded") {
        return jsonResponse({ error: "This payment cannot be refunded." }, 400);
      }
      const remaining = charge.amount - (charge.amount_refunded ?? 0);
      if (remaining <= 0) {
        return jsonResponse({ error: "This payment is already fully refunded." }, 400);
      }

      let amountCents: number | undefined = undefined;
      if (body?.amountCents !== undefined && body?.amountCents !== null) {
        amountCents = Math.round(Number(body.amountCents));
        if (!Number.isFinite(amountCents) || amountCents < 50 || amountCents > remaining) {
          return jsonResponse(
            { error: "Refund amount must be between $0.50 and the remaining balance." },
            400,
          );
        }
      }

      const refund = await stripeFetch("/refunds", {
        secret: stripeSecret,
        stripeAccount: accountId,
        body: {
          charge: chargeId,
          ...(amountCents ? { amount: amountCents } : {}),
        },
      });

      return jsonResponse({
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status,
      });
    }

    if (action === "listSubscriptions") {
      if (!existingAccount?.stripe_account_id) {
        return jsonResponse({ error: "No connected Stripe account." }, 400);
      }
      const accountId = existingAccount.stripe_account_id;

      const subs = await stripeFetch(
        `/subscriptions?limit=100&status=all&expand[0]=data.customer`,
        { method: "GET", secret: stripeSecret, stripeAccount: accountId },
      );

      const list = (subs.data ?? [])
        .filter((s: any) => s.status !== "incomplete_expired")
        .map((s: any) => {
          const item = s.items?.data?.[0];
          const price = item?.price;
          return {
            id: s.id,
            status: s.status,
            cancelAtPeriodEnd: !!s.cancel_at_period_end,
            currentPeriodEnd: s.current_period_end,
            canceledAt: s.canceled_at ?? null,
            amount: price?.unit_amount ?? 0,
            currency: price?.currency ?? "usd",
            interval: price?.recurring?.interval ?? null,
            productName: s.metadata?.display_name ?? item?.price?.nickname ?? null,
            customerName:
              (typeof s.customer === "object" ? s.customer?.name : null) ?? null,
            customerEmail:
              (typeof s.customer === "object" ? s.customer?.email : null) ?? null,
          };
        });

      return jsonResponse({ subscriptions: list });
    }

    if (action === "cancelSubscription") {
      if (!existingAccount?.stripe_account_id) {
        return jsonResponse({ error: "No connected Stripe account." }, 400);
      }
      const accountId = existingAccount.stripe_account_id;

      const subId = String(body?.subscriptionId ?? "").trim();
      if (!/^sub_[A-Za-z0-9_]+$/.test(subId)) {
        return jsonResponse({ error: "Invalid subscription id." }, 400);
      }
      const immediate = body?.immediate === true;

      const updated = immediate
        ? await stripeFetch(`/subscriptions/${subId}`, {
            method: "DELETE",
            secret: stripeSecret,
            stripeAccount: accountId,
          })
        : await stripeFetch(`/subscriptions/${subId}`, {
            secret: stripeSecret,
            stripeAccount: accountId,
            body: { cancel_at_period_end: "true" },
          });

      return jsonResponse({
        id: updated.id,
        status: updated.status,
        cancelAtPeriodEnd: !!updated.cancel_at_period_end,
      });
    }

    if (action === "resumeSubscription") {
      if (!existingAccount?.stripe_account_id) {
        return jsonResponse({ error: "No connected Stripe account." }, 400);
      }
      const accountId = existingAccount.stripe_account_id;
      const subId = String(body?.subscriptionId ?? "").trim();
      if (!/^sub_[A-Za-z0-9_]+$/.test(subId)) {
        return jsonResponse({ error: "Invalid subscription id." }, 400);
      }
      const updated = await stripeFetch(`/subscriptions/${subId}`, {
        secret: stripeSecret,
        stripeAccount: accountId,
        body: { cancel_at_period_end: "false" },
      });
      return jsonResponse({
        id: updated.id,
        status: updated.status,
        cancelAtPeriodEnd: !!updated.cancel_at_period_end,
      });
    }

    if (action === "listCustomers") {
      if (!existingAccount?.stripe_account_id) {
        return jsonResponse({ error: "No connected Stripe account." }, 400);
      }
      const accountId = existingAccount.stripe_account_id;

      const customers = await stripeFetch("/customers?limit=100", {
        method: "GET",
        secret: stripeSecret,
        stripeAccount: accountId,
      });

      // Roll up lifetime spend from the last 100 charges
      const charges = await stripeFetch("/charges?limit=100", {
        method: "GET",
        secret: stripeSecret,
        stripeAccount: accountId,
      });
      const spendByCustomer: Record<string, { total: number; count: number; last: number }> = {};
      const spendByEmail: Record<string, { total: number; count: number; last: number }> = {};
      for (const c of charges.data ?? []) {
        if (c.status !== "succeeded") continue;
        const net = c.amount - (c.amount_refunded ?? 0);
        if (c.customer) {
          const k = String(c.customer);
          spendByCustomer[k] ??= { total: 0, count: 0, last: 0 };
          spendByCustomer[k].total += net;
          spendByCustomer[k].count += 1;
          spendByCustomer[k].last = Math.max(spendByCustomer[k].last, c.created);
        }
        const email = (c.billing_details?.email ?? c.receipt_email ?? "").toLowerCase();
        if (email) {
          spendByEmail[email] ??= { total: 0, count: 0, last: 0 };
          spendByEmail[email].total += net;
          spendByEmail[email].count += 1;
          spendByEmail[email].last = Math.max(spendByEmail[email].last, c.created);
        }
      }

      const list = (customers.data ?? []).map((c: any) => {
        const byId = spendByCustomer[c.id];
        const byEmail = c.email ? spendByEmail[String(c.email).toLowerCase()] : undefined;
        const stats = byId ?? byEmail ?? { total: 0, count: 0, last: 0 };
        return {
          id: c.id,
          name: c.name ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          created: c.created,
          totalSpent: stats.total,
          paymentCount: stats.count,
          lastPayment: stats.last || null,
        };
      });

      list.sort((a: any, b: any) => (b.lastPayment ?? 0) - (a.lastPayment ?? 0));

      return jsonResponse({ customers: list });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error("barber-launch-stripe error", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return jsonResponse({ error: message }, 500);
  }
});
