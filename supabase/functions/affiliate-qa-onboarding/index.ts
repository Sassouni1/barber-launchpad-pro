// TEMPORARY audit helper — test mode only. Deleted after the onboarding audit.
// Mirrors the exact prefill and account-link options used by affiliate-payouts,
// but uses the isolated test key and synthetic QA values only.
const AFFILIATE_MCC = "7311";
const AFFILIATE_DESCRIPTION =
  "Referral commissions earned for introducing new customers to Barber Launch training programs.";

async function stripe(path: string, body?: Record<string, unknown>, method = "POST") {
  const key = Deno.env.get("AFFILIATE_STRIPE_TEST_SECRET_KEY")!;
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("Refusing to run: the configured key is not a Stripe test key.");
  }
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body) {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) form.append(k, String(v));
    init.body = form;
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, init);
  return { ok: res.ok, data: await res.json() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.headers.get("x-qa-token") !== Deno.env.get("AFFILIATE_QA_ONBOARD_TOKEN")) {
    return new Response("forbidden", { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    let accountId = String(body.accountId ?? "");
    if (!accountId) {
      const created = await stripe("/accounts", {
        type: "standard",
        email: "qa-onboarding-audit@example.com",
        business_type: "individual",
        "business_profile[mcc]": AFFILIATE_MCC,
        "business_profile[product_description]": AFFILIATE_DESCRIPTION,
        "metadata[user_id]": "qa-audit",
        "metadata[app]": "barber_launch_affiliate",
        "individual[first_name]": "Qa",
        "individual[last_name]": "Audit",
        "individual[email]": "qa-onboarding-audit@example.com",
      });
      if (!created.ok) return Response.json({ error: created.data?.error?.message }, { status: 400 });
      accountId = String(created.data.id);
    }
    const link = await stripe("/account_links", {
      account: accountId,
      refresh_url: "https://member.thebarberlaunch.com/affiliates?payouts=refresh",
      return_url: "https://member.thebarberlaunch.com/affiliates?payouts=return",
      type: "account_onboarding",
      "collection_options[fields]": "currently_due",
      "collection_options[future_requirements]": "omit",
    });
    if (!link.ok) return Response.json({ error: link.data?.error?.message }, { status: 400 });
    const acct = await stripe(`/accounts/${accountId}`, undefined, "GET");
    return Response.json({
      accountId,
      url: link.data.url,
      capabilities: acct.data?.capabilities ?? null,
      controller: acct.data?.controller ?? null,
      currently_due: acct.data?.requirements?.currently_due ?? null,
      livemode: acct.data?.livemode,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
});
