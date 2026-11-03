// Public Barber Launch enrollment checkout: creates a Stripe Checkout Session (ui_mode=elements) for a custom Payment Element form
// for the fixed Hair System Mastery price. Standalone; no database access.
const ALLOWED_ORIGINS = new Set(["https://thebarberlaunch.com", "https://www.thebarberlaunch.com"]);
const EXPECTED_ACCOUNT = "acct_1LMNKMI6LFtj88Bq";
const PRICE_ID = "price_1UAWi1I6LFtj88BqhYUGuhnC";
const RETURN_URL = "https://thebarberlaunch.com/checkout?session_id={CHECKOUT_SESSION_ID}";

let accountVerified = false;

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function stripe(path: string, key: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2026-03-25.dahlia", ...(init.headers ?? {}) },
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const allowed = !!origin && ALLOWED_ORIGINS.has(origin);

  if (req.method === "OPTIONS") {
    return new Response(allowed ? "ok" : "forbidden", { status: allowed ? 200 : 403, headers: cors(origin) });
  }
  if (!allowed) return json({ error: "Origin not allowed" }, 403, origin);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400, origin); }
  if (
    !body || typeof body !== "object" || Array.isArray(body) ||
    Object.keys(body).length !== 1 || (body as Record<string, unknown>).acceptedTerms !== true
  ) {
    return json({ error: "Body must be exactly {\"acceptedTerms\":true}" }, 400, origin);
  }

  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return json({ error: "Checkout unavailable" }, 503, origin);

  if (!accountVerified) {
    const acct = await stripe("account", key);
    if (!acct.ok || acct.data?.id !== EXPECTED_ACCOUNT) {
      console.error("public-enrollment-checkout: Stripe account verification failed", acct.status);
      return json({ error: "Checkout unavailable" }, 503, origin);
    }
    accountVerified = true;
  }

  const acceptedAt = new Date().toISOString();
  const form = new URLSearchParams({
    mode: "payment",
    ui_mode: "elements",
    "line_items[0][price]": PRICE_ID,
    "line_items[0][quantity]": "1",
    return_url: RETURN_URL,
    billing_address_collection: "required",
    "phone_number_collection[enabled]": "true",
    "metadata[source]": "barber_launch_enrollment",
    "metadata[product]": "hair_system_mastery",
    "metadata[accepted_terms]": "true",
    "metadata[terms_accepted_at]": acceptedAt,
    "payment_intent_data[metadata][source]": "barber_launch_enrollment",
    "payment_intent_data[metadata][accepted_terms]": "true",
    "payment_intent_data[metadata][terms_accepted_at]": acceptedAt,
  });

  const create = (f: URLSearchParams) => stripe("checkout/sessions", key, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": crypto.randomUUID() },
    body: f.toString(),
  });

  const result = await create(form);

  if (!result.ok || !result.data?.client_secret || !result.data?.id) {
    console.error("public-enrollment-checkout: session create failed", result.status, result.data?.error?.code ?? "", result.data?.error?.param ?? "");
    return json({ error: "Unable to start checkout. Please try again." }, 502, origin);
  }

  return json({ clientSecret: result.data.client_secret, sessionId: result.data.id }, 200, origin);
});
