// Member billing + paid domain logic shared by member-billing, cloudflare-domains
// and member-domain-stripe-webhook. Pure decisions with injected I/O so the
// safety rules (customer ownership, saved-card consent, stale price, duplicate
// events, failed registration) are unit-tested without Stripe or Cloudflare.

export const BARBER_LAUNCH_STRIPE_ACCOUNT = "acct_1LMNKMI6LFtj88Bq";
export const DOMAIN_SOURCE = "barber_launch_member_domain";
export const BILLING_SETUP_SOURCE = "barber_launch_member_billing";
export const MAX_EVIDENCE_LOOKUPS = 25;

export const CUSTOMER_RE = /^cus_[A-Za-z0-9]+$/;
export const PAYMENT_METHOD_RE = /^pm_[A-Za-z0-9]+$/;
const SESSION_RE = /^cs_live_[A-Za-z0-9]+$/;
const PAYMENT_INTENT_RE = /^pi_[A-Za-z0-9]+$/;
const CHARGE_RE = /^(ch|py)_[A-Za-z0-9]+$/;

// deno-lint-ignore no-explicit-any
type Obj = Record<string, any>;
/** Returns the Stripe object, null when Stripe says it does not exist; throws on any other failure. */
export type StripeGet = (path: string) => Promise<Obj | null>;
export type StripePost = (path: string, form: URLSearchParams, idempotencyKey?: string) => Promise<Obj>;

export type LinkStatus = "linked" | "already_linked" | "member_has_other_customer" | "customer_owned_by_other" | "no_profile";
export type LinkCustomer = (userId: string, customerId: string, source: string, paymentMethodId?: string | null) => Promise<LinkStatus>;

const idOf = (value: unknown): string | null =>
  typeof value === "string" ? value : value && typeof value === "object" && typeof (value as Obj).id === "string" ? (value as Obj).id : null;

// ---------------------------------------------------------------------------
// Customer resolution: an existing server link, else exactly one Customer traced
// from this member's verified paid claims/grants that no other member's payment
// evidence points to. Never an email match.
// ---------------------------------------------------------------------------

export type GrantRef = { source: string; evidence_ref: string };
export type ClaimRef = { checkout_session_id: string; payment_intent_id: string | null; charge_id: string | null };
export type ResolveDeps = {
  loadProfile(userId: string): Promise<{ stripe_customer_id: string | null; default_payment_method_id: string | null } | null>;
  listClaims(userId: string): Promise<ClaimRef[]>;
  listGrants(userId: string): Promise<GrantRef[]>;
  stripeGet: StripeGet;
  refsOwnedByOthers(userId: string, refs: string[]): Promise<boolean>;
  linkCustomer: LinkCustomer;
};
export type UnresolvedReason = "no_evidence" | "ambiguous" | "owned_by_other" | "customer_unavailable" | "lookup_failed";
export type Resolution =
  | { status: "resolved"; customerId: string; source: string; defaultPaymentMethodId: string | null }
  | { status: "unresolved"; reason: UnresolvedReason };

type EvidenceLookup = { kind: "session" | "payment_intent" | "charge"; ref: string; source: string };

export function evidenceLookups(claims: ClaimRef[], grants: GrantRef[]): EvidenceLookup[] {
  const out: EvidenceLookup[] = [];
  const seen = new Set<string>();
  const add = (kind: EvidenceLookup["kind"], ref: string, source: string) => {
    if (!seen.has(ref)) { seen.add(ref); out.push({ kind, ref, source }); }
  };
  for (const claim of claims) {
    if (claim.payment_intent_id && PAYMENT_INTENT_RE.test(claim.payment_intent_id)) add("payment_intent", claim.payment_intent_id, "checkout_claim");
    else if (SESSION_RE.test(claim.checkout_session_id)) add("session", claim.checkout_session_id, "checkout_claim");
  }
  for (const grant of grants) {
    const ref = grant.evidence_ref ?? "";
    if ((grant.source === "stripe_checkout" || grant.source === "hair_system_order") && SESSION_RE.test(ref)) add("session", ref, `grant_${grant.source}`);
    else if (grant.source === "stripe_charge" && CHARGE_RE.test(ref)) add("charge", ref, "grant_stripe_charge");
    else if (grant.source === "stripe_charge" && PAYMENT_INTENT_RE.test(ref)) add("payment_intent", ref, "grant_stripe_charge");
  }
  return out;
}

/** The paying Customer of one verified live payment, or null when it is not a paid live object. */
async function customerFromEvidence(stripeGet: StripeGet, lookup: EvidenceLookup): Promise<string | null> {
  if (lookup.kind === "session") {
    const session = await stripeGet(`checkout/sessions/${encodeURIComponent(lookup.ref)}`);
    if (!session || session.livemode !== true || session.payment_status !== "paid") return null;
    const direct = idOf(session.customer);
    if (direct) return direct;
    const pi = idOf(session.payment_intent);
    return pi ? customerFromEvidence(stripeGet, { kind: "payment_intent", ref: pi, source: lookup.source }) : null;
  }
  if (lookup.kind === "payment_intent") {
    const intent = await stripeGet(`payment_intents/${encodeURIComponent(lookup.ref)}`);
    if (!intent || intent.livemode !== true || intent.status !== "succeeded") return null;
    return idOf(intent.customer);
  }
  const charge = await stripeGet(`charges/${encodeURIComponent(lookup.ref)}`);
  if (!charge || charge.livemode !== true || charge.paid !== true || charge.status !== "succeeded") return null;
  return idOf(charge.customer);
}

async function verifyCustomerUsable(stripeGet: StripeGet, customerId: string, userId: string): Promise<"ok" | "unavailable" | "other_member"> {
  const customer = await stripeGet(`customers/${encodeURIComponent(customerId)}`);
  if (!customer || customer.deleted === true || customer.livemode !== true) return "unavailable";
  const owner = customer.metadata?.barber_launch_member_id;
  if (typeof owner === "string" && owner && owner !== userId) return "other_member";
  return "ok";
}

export async function resolveMemberStripeCustomer(deps: ResolveDeps, userId: string): Promise<Resolution> {
  try {
    const profile = await deps.loadProfile(userId);
    if (profile?.stripe_customer_id) {
      // Older server paths could write the same Customer to two members. Check
      // exclusive ownership before showing any card from an existing link.
      const ownership = await deps.linkCustomer(userId, profile.stripe_customer_id, "existing_link");
      if (ownership !== "linked" && ownership !== "already_linked")
        return { status: "unresolved", reason: ownership === "customer_owned_by_other" ? "owned_by_other" : "ambiguous" };
      const usable = await verifyCustomerUsable(deps.stripeGet, profile.stripe_customer_id, userId);
      if (usable === "ok") return { status: "resolved", customerId: profile.stripe_customer_id, source: "existing_link", defaultPaymentMethodId: profile.default_payment_method_id };
      return { status: "unresolved", reason: usable === "other_member" ? "owned_by_other" : "customer_unavailable" };
    }

    const lookups = evidenceLookups(await deps.listClaims(userId), await deps.listGrants(userId));
    if (!lookups.length) return { status: "unresolved", reason: "no_evidence" };
    if (lookups.length > MAX_EVIDENCE_LOOKUPS) return { status: "unresolved", reason: "ambiguous" };

    const customers = new Map<string, string>();
    for (const lookup of lookups) {
      const customer = await customerFromEvidence(deps.stripeGet, lookup);
      if (customer && CUSTOMER_RE.test(customer) && !customers.has(customer)) customers.set(customer, lookup.source);
    }
    if (customers.size === 0) return { status: "unresolved", reason: "no_evidence" };
    if (customers.size > 1) return { status: "unresolved", reason: "ambiguous" };
    const [[customerId, source]] = [...customers.entries()];

    const usable = await verifyCustomerUsable(deps.stripeGet, customerId, userId);
    if (usable !== "ok") return { status: "unresolved", reason: usable === "other_member" ? "owned_by_other" : "customer_unavailable" };

    // Every payment this Customer made must belong to this member (or to nobody).
    const charges = await deps.stripeGet(`charges?customer=${encodeURIComponent(customerId)}&limit=100`);
    const sessions = await deps.stripeGet(`checkout/sessions?customer=${encodeURIComponent(customerId)}&limit=100`);
    if (!charges || !sessions) return { status: "unresolved", reason: "lookup_failed" };
    if (charges.has_more || sessions.has_more) return { status: "unresolved", reason: "ambiguous" };
    const refs = new Set<string>();
    for (const charge of charges.data ?? []) {
      if (typeof charge.id === "string") refs.add(charge.id);
      const pi = idOf(charge.payment_intent);
      if (pi) refs.add(pi);
    }
    for (const session of sessions.data ?? []) if (typeof session.id === "string") refs.add(session.id);
    if (refs.size && await deps.refsOwnedByOthers(userId, [...refs])) return { status: "unresolved", reason: "owned_by_other" };

    const link = await deps.linkCustomer(userId, customerId, source);
    if (link === "linked" || link === "already_linked") return { status: "resolved", customerId, source, defaultPaymentMethodId: null };
    if (link === "member_has_other_customer") {
      // Another server path linked a different Customer first; that link wins.
      const again = await deps.loadProfile(userId);
      if (again?.stripe_customer_id) return { status: "resolved", customerId: again.stripe_customer_id, source: "existing_link", defaultPaymentMethodId: again.default_payment_method_id };
      return { status: "unresolved", reason: "ambiguous" };
    }
    return { status: "unresolved", reason: link === "customer_owned_by_other" ? "owned_by_other" : "ambiguous" };
  } catch {
    // Partial reads could hide a second owner, so any failed read leaves the member unresolved.
    return { status: "unresolved", reason: "lookup_failed" };
  }
}

// ---------------------------------------------------------------------------
// Cards: masked views only (brand, last four, expiry). Never raw card details.
// ---------------------------------------------------------------------------

export type Redisplay = "always" | "limited" | "unspecified";
export type CardView = {
  id: string; brand: string; last4: string; expMonth: number; expYear: number;
  expired: boolean; isDefault: boolean; redisplay: Redisplay;
};

export function cardExpired(expMonth: number, expYear: number, now: Date): boolean {
  if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12 || !Number.isInteger(expYear)) return true;
  // A card is valid through the last day of its expiry month (UTC).
  return now.getTime() >= Date.UTC(expYear, expMonth, 1);
}

export function toCardViews(paymentMethods: Obj[], customerId: string, defaultPaymentMethodId: string | null, now: Date): CardView[] {
  return paymentMethods
    .filter(pm => pm?.type === "card" && idOf(pm.customer) === customerId && pm.card && PAYMENT_METHOD_RE.test(pm.id ?? ""))
    .map(pm => {
      const redisplay: Redisplay = pm.allow_redisplay === "always" || pm.allow_redisplay === "limited" ? pm.allow_redisplay : "unspecified";
      const expMonth = Number(pm.card.exp_month), expYear = Number(pm.card.exp_year);
      return {
        id: pm.id, brand: String(pm.card.display_brand ?? pm.card.brand ?? "card"), last4: String(pm.card.last4 ?? "").slice(-4),
        expMonth, expYear, expired: cardExpired(expMonth, expYear, now), isDefault: pm.id === defaultPaymentMethodId, redisplay,
      };
    });
}

export const eligibleSavedCards = (cards: CardView[]) => cards.filter(card => !card.expired && /^\d{4}$/.test(card.last4));

/** A member may act on a card only when it is attached to their own verified Customer. */
export function assertCardOwned(paymentMethod: Obj | null, customerId: string | null): paymentMethod is Obj {
  return !!paymentMethod && !!customerId && paymentMethod.type === "card" && idOf(paymentMethod.customer) === customerId;
}

// ---------------------------------------------------------------------------
// Domain checkout plan.
// ---------------------------------------------------------------------------

export type PaymentChoice = { method: "saved"; paymentMethodId: string } | { method: "new"; saveCard: boolean };

export function parsePaymentChoice(raw: unknown): PaymentChoice | null {
  if (raw === undefined || raw === null) return { method: "new", saveCard: false };
  if (typeof raw !== "object") return null;
  const value = raw as Obj;
  if (value.method === "saved") return typeof value.paymentMethodId === "string" && PAYMENT_METHOD_RE.test(value.paymentMethodId) ? { method: "saved", paymentMethodId: value.paymentMethodId } : null;
  if (value.method === "new") return { method: "new", saveCard: value.saveCard === true };
  return null;
}

export type DomainCheckoutInput = {
  orderId: string; userId: string; domain: string; amountCents: number; email: string | null;
  resolution: Resolution; choice: PaymentChoice; eligibleCards: CardView[]; memberSite: string;
};

export function domainCheckoutForm(input: DomainCheckoutInput): { ok: true; form: URLSearchParams } | { ok: false; status: number; error: string } {
  const { orderId, userId, domain, amountCents, email, resolution, choice, eligibleCards, memberSite } = input;
  if (!Number.isInteger(amountCents) || amountCents < 100) return { ok: false, status: 409, error: "This domain needs manual pricing review" };
  const linked = resolution.status === "resolved" ? resolution.customerId : null;
  let selected: CardView | undefined;
  if (choice.method === "saved") {
    if (!linked) return { ok: false, status: 409, error: "Saved cards are unavailable for this account. Use a new card." };
    selected = eligibleCards.find(card => card.id === choice.paymentMethodId);
    if (!selected) return { ok: false, status: 409, error: "That saved card can't be used. Choose another card or use a new card." };
  }
  const saveCard = choice.method === "new" && choice.saveCard;
  const form = new URLSearchParams({
    mode: "payment",
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(amountCents),
    "line_items[0][price_data][product_data][name]": `Domain registration (1 year): ${domain}`,
    "line_items[0][quantity]": "1",
    success_url: `${memberSite}/my-website?domain_order=${orderId}`,
    cancel_url: `${memberSite}/my-website?domain_order=${orderId}&cancelled=1`,
    "metadata[source]": DOMAIN_SOURCE, "metadata[order_id]": orderId,
    "metadata[user_id]": userId, "metadata[domain]": domain,
    "metadata[payment_choice]": choice.method, "metadata[save_card]": String(saveCard),
    "metadata[customer_link]": linked ? "existing" : "new",
    "payment_intent_data[metadata][source]": DOMAIN_SOURCE,
    "payment_intent_data[metadata][order_id]": orderId,
    "payment_intent_data[metadata][user_id]": userId,
    "payment_intent_data[metadata][domain]": domain,
  });
  if (linked) {
    form.set("customer", linked);
    form.set("metadata[stripe_customer]", linked);
    // Show the member's chosen saved card in Stripe; the member still selects it and confirms this one payment there.
    if (selected) form.set("saved_payment_method_options[allow_redisplay_filters][0]", selected.redisplay);
  } else {
    if (email) form.set("customer_email", email);
    form.set("customer_creation", "always");
  }
  // Saving a new card happens only on the member's explicit opt-in for this purchase.
  if (saveCard) form.set("payment_intent_data[setup_future_usage]", "on_session");
  return { ok: true, form };
}

// ---------------------------------------------------------------------------
// Paid-event processing (signature already verified by the webhook).
// ---------------------------------------------------------------------------

export type DomainOrder = {
  id: string; user_id: string; domain: string; status: string; member_charge_cents: number;
  cloudflare_cost_cents: number; stripe_session_id: string | null;
};
export type CloudflareCall = (path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; data: Obj }>;
export type WebhookDeps = {
  stripeGet: StripeGet;
  stripePost: StripePost;
  cloudflare: CloudflareCall;
  registrar: { accountId: string; token: string } | null;
  loadOrder(id: string): Promise<DomainOrder | null>;
  /** Atomically moves checkout_open/checkout_pending → registering; true for exactly one caller. */
  claimOrder(id: string, sessionId: string, paymentIntentId: string | null): Promise<boolean>;
  updateOrder(id: string, patch: Obj): Promise<void>;
  /** Assigns the domain to the member's website only when it has none; true when a row changed. */
  assignWebsite(userId: string, domain: string, registrationState: string): Promise<boolean>;
  linkCustomer: LinkCustomer;
  log(message: string): void;
};

export function sessionMismatch(session: Obj, order: DomainOrder): string | null {
  if (session.livemode !== true) return "not_live";
  if (session.mode !== "payment") return "mode";
  if (session.status !== undefined && session.status !== "complete") return "incomplete";
  if (session.payment_status !== "paid") return "unpaid";
  if (session.currency !== "usd") return "currency";
  if (session.amount_total !== order.member_charge_cents) return "amount";
  if (session.metadata?.order_id !== order.id) return "order";
  if (session.metadata?.user_id !== order.user_id) return "member";
  if (session.metadata?.domain !== order.domain) return "domain";
  if (order.stripe_session_id && order.stripe_session_id !== session.id) return "session";
  return null;
}

export type BillingAttach = "no_customer" | "mismatch" | "not_linked" | "linked" | "linked_with_card";

/** Links the paying Customer and (only on explicit opt-in) the paid card, after the payment fully matches the order. */
export async function attachBillingAfterPayment(deps: Pick<WebhookDeps, "stripeGet" | "stripePost" | "linkCustomer">, session: Obj, order: DomainOrder): Promise<BillingAttach> {
  const customerId = idOf(session.customer);
  if (!customerId || !CUSTOMER_RE.test(customerId)) return "no_customer";
  if (session.metadata?.customer_link === "existing" && session.metadata?.stripe_customer !== customerId) return "mismatch";
  const piId = idOf(session.payment_intent);
  if (!piId) return "mismatch";
  const intent = await deps.stripeGet(`payment_intents/${encodeURIComponent(piId)}?expand[]=payment_method`);
  if (!intent || intent.livemode !== true || intent.status !== "succeeded" || idOf(intent.customer) !== customerId ||
      intent.amount_received !== order.member_charge_cents || intent.metadata?.order_id !== order.id ||
      intent.metadata?.user_id !== order.user_id) return "mismatch";
  const source = session.metadata?.customer_link === "existing" ? "domain_checkout_existing" : "domain_checkout_new";
  const link = await deps.linkCustomer(order.user_id, customerId, source);
  if (link !== "linked" && link !== "already_linked") return "not_linked";
  if (session.metadata?.save_card !== "true") return "linked";
  const pm = typeof intent.payment_method === "object" ? intent.payment_method : null;
  if (!assertCardOwned(pm, customerId)) return "linked";
  await deps.stripePost(`payment_methods/${encodeURIComponent(pm.id)}`, new URLSearchParams({ allow_redisplay: "always" }));
  const withCard = await deps.linkCustomer(order.user_id, customerId, source, pm.id);
  return withCard === "linked" || withCard === "already_linked" ? "linked_with_card" : "linked";
}

export type PaidOutcome = "ignored" | "duplicate" | "registered" | "registration_pending" | "action_required";

export async function processPaidDomainSession(deps: WebhookDeps, sessionId: string): Promise<PaidOutcome> {
  const session = await deps.stripeGet(`checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (!session) throw new Error("Checkout session not found");
  const orderId = session.metadata?.order_id;
  if (session.metadata?.source !== DOMAIN_SOURCE || !/^[0-9a-f-]{36}$/i.test(orderId || "")) return "ignored";
  const order = await deps.loadOrder(orderId);
  if (!order) throw new Error("Domain order not found");
  if (["registered", "registration_pending", "registering"].includes(order.status)) return "duplicate";
  if (order.status !== "checkout_open" && order.status !== "checkout_pending") return "duplicate";
  const mismatch = sessionMismatch(session, order);
  if (mismatch) throw new Error(`Domain payment evidence did not match the reserved order (${mismatch})`);

  // Only one invocation may start a billable Cloudflare registration.
  if (!await deps.claimOrder(order.id, session.id, idOf(session.payment_intent))) return "duplicate";

  try {
    const attached = await attachBillingAfterPayment(deps, session, order);
    deps.log(`member-domain billing link: ${attached}`);
  } catch (error) {
    deps.log(`member-domain billing link failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  if (!deps.registrar) {
    await deps.updateOrder(order.id, { status: "action_required", last_error: "Registrar credentials unavailable" });
    return "action_required";
  }
  const prefix = `/accounts/${deps.registrar.accountId}/registrar`;
  const check = await deps.cloudflare(`${prefix}/domain-check`, { method: "POST", body: JSON.stringify({ domains: [order.domain] }) });
  const candidate = check.data?.result?.domains?.[0];
  const currentCost = Math.round(Number(candidate?.pricing?.registration_cost) * 100);
  if (!check.ok || candidate?.registrable !== true || candidate?.tier === "premium" ||
      candidate?.pricing?.currency !== "USD" || !Number.isFinite(currentCost) || currentCost > order.cloudflare_cost_cents) {
    await deps.updateOrder(order.id, { status: "action_required", last_error: "Domain availability or price changed after payment; review and refund if needed" });
    return "action_required";
  }
  const registration = await deps.cloudflare(`${prefix}/registrations`, {
    method: "POST", body: JSON.stringify({ domain_name: order.domain, auto_renew: false }),
  });
  if (!registration.ok) {
    await deps.updateOrder(order.id, { status: "action_required", last_error: `Registration needs review (${registration.status})` });
    return "action_required";
  }
  const state = String(registration.data?.result?.state ?? "in_progress");
  const status = state === "succeeded" ? "registered" : state === "in_progress" ? "registration_pending" : "action_required";
  await deps.updateOrder(order.id, {
    status, cloudflare_registration_state: state, last_error: status === "action_required" ? "Registration needs review" : null,
    updated_at: new Date().toISOString(),
  });
  if (!await deps.assignWebsite(order.user_id, order.domain, state)) {
    await deps.updateOrder(order.id, { status: "action_required", last_error: "Domain purchased but could not be assigned to the website" });
    throw new Error("Domain assignment did not update a website");
  }
  return status as PaidOutcome;
}
