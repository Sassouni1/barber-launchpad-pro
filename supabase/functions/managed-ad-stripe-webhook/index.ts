import { createClient } from "npm:@supabase/supabase-js@2";
import { readManagedAdsWebhookSecret } from "../_shared/managedAdVault.ts";


function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

async function verifyStripeSignature(payload: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const timestamp = signature.split(",").find((part) => part.startsWith("t="))?.slice(2);
  const signatures = signature.split(",").filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return signatures.some((candidate) => timingSafeEqual(candidate, expected));
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  try {
    let webhookSecret = Deno.env.get("STRIPE_MANAGED_ADS_WEBHOOK_SECRET") ?? null;
    if (!webhookSecret) {
      try {
        webhookSecret = await readManagedAdsWebhookSecret();
      } catch (error) {
        console.error("managed-ad-stripe-webhook: vault read failed", error instanceof Error ? error.message : error);
        webhookSecret = null;
      }
    }
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!webhookSecret || !stripeSecret) return response({ error: "Webhook is not configured" }, 503);

    const rawBody = await req.text();
    if (!(await verifyStripeSignature(rawBody, req.headers.get("Stripe-Signature"), webhookSecret))) return response({ error: "Invalid signature" }, 400);
    const event = JSON.parse(rawBody);
    if (event.type !== "checkout.session.completed") return response({ received: true });

    const session = event.data?.object;
    const transactionId = session?.metadata?.transaction_id;
    if (!transactionId) return response({ received: true });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: transaction, error: transactionError } = await admin.from("ad_payment_transactions")
      .select("*").eq("id", transactionId).maybeSingle();
    if (transactionError) throw transactionError;
    if (!transaction || transaction.status === "succeeded") return response({ received: true });

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (!paymentIntentId || !customerId || !transaction.campaign_id) throw new Error("Checkout session is missing payment information");
    const paymentIntentResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: { Authorization: `Bearer ${stripeSecret}` },
    });
    const paymentIntent = await paymentIntentResponse.json();
    if (!paymentIntentResponse.ok || paymentIntent.status !== "succeeded") throw new Error("Payment was not successful");

    const { error: updateError } = await admin.from("ad_payment_transactions").update({
      stripe_payment_intent_id: paymentIntentId,
      status: "succeeded",
      completed_at: new Date().toISOString(),
    }).eq("id", transaction.id).neq("status", "succeeded");
    if (updateError) throw updateError;

    const { error: billingError } = await admin.from("ad_billing_profiles").upsert({
      customer_id: transaction.customer_id,
      stripe_customer_id: customerId,
      default_payment_method_id: paymentIntent.payment_method,
    }, { onConflict: "customer_id" });
    if (billingError) throw billingError;

    const { error: ledgerError } = await admin.from("ad_spend_ledger_entries").insert({
      campaign_id: transaction.campaign_id,
      customer_id: transaction.customer_id,
      payment_transaction_id: transaction.id,
      entry_type: "funding",
      amount_cents: transaction.amount_cents,
      external_reference: paymentIntentId,
      note: "Stripe prepaid media funding",
    });
    if (ledgerError && ledgerError.code !== "23505") throw ledgerError;

    await admin.from("ad_campaigns").update({ status: "draft" }).eq("id", transaction.campaign_id).eq("status", "payment_required");
    await admin.from("ad_campaign_events").insert({
      customer_id: transaction.customer_id,
      campaign_id: transaction.campaign_id,
      event_type: "funding_succeeded",
      detail: { payment_transaction_id: transaction.id, amount_cents: transaction.amount_cents },
    });
    return response({ received: true });
  } catch (error) {
    console.error("managed-ad-stripe-webhook", error);
    return response({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
