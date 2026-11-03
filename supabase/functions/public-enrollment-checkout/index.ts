// Public Barber Launch enrollment checkout: creates a Stripe Checkout Session (ui_mode=elements) for a custom Payment Element form
// for the fixed Hair System Mastery price, and records terms acceptance on that session. Standalone; no database access.
const ALLOWED_ORIGINS = new Set(["https://thebarberlaunch.com", "https://www.thebarberlaunch.com"]);
const EXPECTED_ACCOUNT = "acct_1LMNKMI6LFtj88Bq";
const PRICE_ID = "price_1UAWi1I6LFtj88BqhYUGuhnC";
const PRICE_AMOUNT = 299700;
const RETURN_URL = "https://thebarberlaunch.com/checkout?session_id={CHECKOUT_SESSION_ID}";
const SOURCE = "barber_launch_enrollment";
const PRODUCT = "hair_system_mastery";

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

const post = (path: string, key: string, form: URLSearchParams) => stripe(path, key, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": crypto.randomUUID() },
  body: form.toString(),
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const allowed = !!origin && ALLOWED_ORIGINS.has(origin);

  if (req.method === "OPTIONS") {
    return new Response(allowed ? "ok" : "forbidden", { status: allowed ? 200 : 403, headers: cors(origin) });
  }
  if (!allowed) return json({ error: "Origin not allowed" }, 403, origin);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400, origin); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid body" }, 400, origin);

  const keys = Object.keys(body).sort().join(",");
  const isCreate = body.action === "create" && keys === "action";
  const isAccept = body.action === "acceptTerms" && keys === "action,sessionId" &&
    typeof body.sessionId === "string" && /^cs_live_[A-Za-z0-9]{10,200}$/.test(body.sessionId);
  if (!isCreate && !isAccept) {
    return json({ error: "Body must be {\"action\":\"create\"} or {\"action\":\"acceptTerms\",\"sessionId\":\"cs_live_...\"}" }, 400, origin);
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

  if (isCreate) {
    const form = new URLSearchParams({
      mode: "payment",
      ui_mode: "elements",
      "line_items[0][price]": PRICE_ID,
      "line_items[0][quantity]": "1",
      return_url: RETURN_URL,
      billing_address_collection: "required",
      "phone_number_collection[enabled]": "true",
      "metadata[source]": SOURCE,
      "metadata[product]": PRODUCT,
      "payment_intent_data[metadata][source]": SOURCE,
      "payment_intent_data[metadata][product]": PRODUCT,
    });
    const result = await post("checkout/sessions", key, form);
    if (!result.ok || !result.data?.client_secret || !result.data?.id) {
      console.error("public-enrollment-checkout: session create failed", result.status, result.data?.error?.code ?? "");
      return json({ error: "Unable to start checkout. Please try again." }, 502, origin);
    }
    return json({ clientSecret: result.data.client_secret, sessionId: result.data.id }, 200, origin);
  }

  // acceptTerms
  const sessionId = body.sessionId as string;
  const fail = () => json({ error: "Unable to record terms acceptance" }, 409, origin);
  const s = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`, key);
  const d = s.data;
  const items = d?.line_items?.data;
  const valid = s.ok && d?.id === sessionId && d.livemode === true && d.object === "checkout.session" &&
    d.mode === "payment" && d.ui_mode === "elements" && d.status === "open" && d.payment_status === "unpaid" &&
    d.metadata?.source === SOURCE && d.metadata?.product === PRODUCT &&
    d.amount_total === PRICE_AMOUNT && d.currency === "usd" &&
    Array.isArray(items) && items.length === 1 && d.line_items?.has_more === false &&
    items[0]?.price?.id === PRICE_ID && items[0]?.quantity === 1 && items[0]?.price?.unit_amount === PRICE_AMOUNT;
  if (!valid) {
    console.error("public-enrollment-checkout: acceptTerms verification failed", s.status);
    return fail();
  }
  const upd = await post(`checkout/sessions/${encodeURIComponent(sessionId)}`, key, new URLSearchParams({
    "metadata[accepted_terms]": "true",
    "metadata[terms_accepted_at]": new Date().toISOString(),
  }));
  if (!upd.ok || upd.data?.metadata?.accepted_terms !== "true") {
    console.error("public-enrollment-checkout: acceptTerms update failed", upd.status, upd.data?.error?.code ?? "");
    return fail();
  }
  return json({ ok: true }, 200, origin);
});
