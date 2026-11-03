// Card-setup (Stripe Checkout mode=setup) logic for Barber Launch managed ads.
// Card setup never charges, never touches the funding ledger, and never changes campaign status.

export const AD_CARD_SETUP_PURPOSE = "ad_card_setup";

export type SetupSession = {
  id?: string;
  mode?: string;
  status?: string;
  customer?: string | { id?: string } | null;
  setup_intent?: string | { id?: string } | null;
  metadata?: Record<string, string> | null;
};

export type SetupIntent = {
  id?: string;
  status?: string;
  customer?: string | { id?: string } | null;
  payment_method?: string | { id?: string } | null;
};

export type SetupDeps = {
  retrieveSetupIntent: (id: string) => Promise<SetupIntent>;
  loadBillingProfile: (memberId: string) => Promise<{ stripe_customer_id: string | null; default_payment_method_id: string | null } | null>;
  saveDefaultPaymentMethod: (memberId: string, stripeCustomerId: string, paymentMethodId: string) => Promise<void>;
};

export type SetupOutcome =
  | { handled: false }
  | { handled: true; result: "saved" | "duplicate" }
  | { handled: true; result: "rejected"; reason: string };

const idOf = (value: unknown): string | null =>
  typeof value === "string" ? value : (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string")
    ? (value as { id: string }).id
    : null;

export function isAdCardSetupSession(session: SetupSession | null | undefined): boolean {
  return !!session && session.mode === "setup" && session.metadata?.purpose === AD_CARD_SETUP_PURPOSE;
}

export async function handleAdCardSetupSession(session: SetupSession, deps: SetupDeps): Promise<SetupOutcome> {
  if (!isAdCardSetupSession(session)) return { handled: false };
  const memberId = session.metadata?.customer_id;
  const sessionCustomer = idOf(session.customer);
  const setupIntentId = idOf(session.setup_intent);
  if (!memberId || !sessionCustomer || !setupIntentId) return { handled: true, result: "rejected", reason: "missing_session_fields" };
  if (session.status && session.status !== "complete") return { handled: true, result: "rejected", reason: "session_not_complete" };

  const profile = await deps.loadBillingProfile(memberId);
  if (!profile?.stripe_customer_id || profile.stripe_customer_id !== sessionCustomer) {
    return { handled: true, result: "rejected", reason: "customer_mismatch" };
  }
  const intent = await deps.retrieveSetupIntent(setupIntentId);
  if (intent.status !== "succeeded") return { handled: true, result: "rejected", reason: "setup_not_succeeded" };
  if (idOf(intent.customer) !== sessionCustomer) return { handled: true, result: "rejected", reason: "intent_customer_mismatch" };
  const paymentMethodId = idOf(intent.payment_method);
  if (!paymentMethodId) return { handled: true, result: "rejected", reason: "missing_payment_method" };
  if (profile.default_payment_method_id === paymentMethodId) return { handled: true, result: "duplicate" };
  await deps.saveDefaultPaymentMethod(memberId, sessionCustomer, paymentMethodId);
  return { handled: true, result: "saved" };
}

/** Body for Stripe embedded Checkout in setup mode. No amount, no line items. */
export function buildSetupSessionBody(input: { stripeCustomerId: string; memberId: string; appUrl: string }) {
  return {
    mode: "setup",
    ui_mode: "embedded",
    currency: "usd",
    customer: input.stripeCustomerId,
    "payment_method_types[0]": "card",
    return_url: `${input.appUrl}/ads?setup_session_id={CHECKOUT_SESSION_ID}`,
    "metadata[purpose]": AD_CARD_SETUP_PURPOSE,
    "metadata[customer_id]": input.memberId,
    "setup_intent_data[metadata][purpose]": AD_CARD_SETUP_PURPOSE,
    "setup_intent_data[metadata][customer_id]": input.memberId,
  } as Record<string, string>;
}
