// Payment-method rules for member Stripe Payment Links (pure, unit-tested).
// One-time links use Stripe dynamic payment methods: omitting payment_method_types on
// create, or sending it as an empty string on update, lets the connected account's own
// payment-method settings and checkout eligibility decide (card plus eligible Klarna,
// Afterpay/Clearpay, Affirm). Recurring links and unchecked custom links stay card-only.

// barber_launch_payment_links.payment_method_types is NOT NULL text[]; this sentinel
// records "Stripe dynamic methods" there instead of SQL NULL.
export const DYNAMIC_METHODS_SENTINEL = "dynamic";

export type LinkMethodMode = "dynamic" | "card";

export const PAY_OVER_TIME_METHODS = ["klarna", "afterpay_clearpay", "affirm"] as const;
export type PayOverTimeMethod = typeof PAY_OVER_TIME_METHODS[number];
export type PayOverTimeState = "on" | "needs_activation" | "off";

// Custom links: an explicit false from either the new flag or the legacy allowKlarna
// flag (older frontends) keeps the link card-only.
export function customLinkMethodMode(
  body: { allowPayOverTime?: unknown; allowKlarna?: unknown } | null | undefined,
  isRecurring: boolean,
): LinkMethodMode {
  if (isRecurring) return "card";
  if (body?.allowPayOverTime === false || body?.allowKlarna === false) return "card";
  return "dynamic";
}

export function storedMethodTypes(mode: LinkMethodMode): string[] {
  return mode === "dynamic" ? [DYNAMIC_METHODS_SENTINEL] : ["card"];
}

// Params for POST /payment_links. Dynamic = omit payment_method_types entirely.
export function creationMethodParams(mode: LinkMethodMode): Record<string, string> {
  return mode === "card" ? { "payment_method_types[0]": "card" } : {};
}

// Params for POST /payment_links/{id} that switch a link to dynamic methods.
export const DYNAMIC_UPDATE_PARAMS: Record<string, string> = { payment_method_types: "" };

// Sync migrates only active one-time links that currently list klarna.
export function needsDynamicMigration(link: {
  active?: boolean | null;
  recurring_interval?: string | null;
  payment_method_types?: string[] | null;
}): boolean {
  return link.active === true &&
    !link.recurring_interval &&
    Array.isArray(link.payment_method_types) &&
    link.payment_method_types.includes("klarna");
}

// Stripe returns payment_method_types null (or empty) when a link uses dynamic methods.
export function stripeConfirmsDynamic(link: { payment_method_types?: unknown } | null | undefined): boolean {
  if (!link || typeof link !== "object") return false;
  const types = link.payment_method_types;
  return types === null || (Array.isArray(types) && types.length === 0);
}

// Summarize the connected account's default payment method configuration.
// available = Stripe will offer it; preference "on" but not available = needs activation.
export function summarizePayOverTime(
  configs: Array<Record<string, any>> | null | undefined,
): Record<PayOverTimeMethod, PayOverTimeState> | null {
  const list = Array.isArray(configs) ? configs : [];
  const config = list.find((c) => c?.is_default && c?.active !== false) ??
    list.find((c) => c?.active !== false && !c?.parent);
  if (!config) return null;
  const out = {} as Record<PayOverTimeMethod, PayOverTimeState>;
  for (const method of PAY_OVER_TIME_METHODS) {
    const entry = config[method];
    if (entry?.available === true) out[method] = "on";
    else if (entry?.display_preference?.value === "on") out[method] = "needs_activation";
    else out[method] = "off";
  }
  return out;
}
