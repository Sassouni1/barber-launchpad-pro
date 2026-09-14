# Barber Launch Affiliate Program

Custom, self-hosted affiliate system inside the existing member app. No third-party affiliate platform, no GHL dependency. Commission is 20% of eligible collected enrollment revenue ($600 on $3,000), accrued only from signed Stripe webhook events.

## What I found first (affects the build)

- The only Stripe key configured (`STRIPE_SECRET_KEY`) is currently used as the **Connect platform** key for members' own client payment links and for managed-ad billing. That is not proof it is the Barber Launch **enrollment seller** account, and no $3,000 enrollment price is referenced anywhere in the code.
- The only booking destination in the app is the **member** one-on-one calendar. There is no verified **prospect sales-call** URL.
- "Link Pay" is not identifiable in this codebase, so no claim will be made that its payments are covered.

Because of this, public enrollment checkout ships **disabled**, showing an honest setup message, until the seller account, price ID, webhook secret and sales-call URL are confirmed in admin setup.

## Member experience

New authenticated page `/affiliates` (desktop sidebar + mobile menu), showing a server-generated affiliate code and three individually copyable links, each with its exact required text:

1. Sales call funnel — "Use this if you want the person to speak with the Barber Launch team first. It still gets accounted to you. Don't worry."
2. Direct payment — "If you're confident that this person will sign up right now without needing a call, use this link."
3. Both — "If you're not really sure, use this link."

Below that: referrals saved, commissions verified, pending review, paid, and refund/dispute adjustments (shown as negatives). Every number comes from the ledger; nothing estimated.

## Public referral pages

- `/refer/:code/call`, `/refer/:code/pay`, `/refer/:code/both` (the Both page offers a choice).
- Each collects name, email and phone and **saves the lead server-side before** sending the prospect to booking or checkout, so a sale closed days later on a call still matches by verified identity.
- Concise affiliate commission disclosure on each page.
- First established referral wins; self-referral blocked; no silent reassignment. Returning leads are recognized without revealing stored details or handing out tokens.

## Admin

`/admin/affiliates`: affiliate list with identity, lead contact details, suspend/reactivate, reconciliation of verified Stripe payment records to referrals (real payment proof only, never amount-only matching), audited manual corrections, and recording an already-completed external payout receipt (no money is moved by the app). A setup panel surfaces the remaining decisions rather than choosing them silently: seller account confirmation, approved enrollment price IDs, sales-call URL, attribution window, payout timing, affiliate terms text, and a live-enabled flag.

## Technical section

**Migration `affiliate_program`** (all additive, RLS on, explicit GRANTs):
`affiliates`, `affiliate_referrals` (private lead PII + opaque token hash), `affiliate_payments` (immutable Stripe payment identity, livemode flag), `affiliate_commissions` (ledger incl. negative refund/dispute rows), `affiliate_payouts`, `affiliate_admin_audit`, `affiliate_webhook_events` (idempotency on event id), `affiliate_intake_rate_limits`, `affiliate_settings`. Affiliates read only their own sanitized rows via security-definer functions; admins via `has_role`; `anon` gets no table grants at all — public intake goes through an Edge Function only.

**Edge Functions:**
- `affiliate-intake` (public, validated, rate-limited): resolve code, create/reuse referral, return a booking or checkout redirect; refuses to mint checkout while setup is incomplete.
- `affiliate-checkout` (public, gated): hosted Stripe Checkout with the approved enrollment price, `client_reference_id` and server-side referral metadata.
- `affiliate-stripe-webhook` (signed, dedicated `AFFILIATE_STRIPE_WEBHOOK_SECRET`): verifies signature, paid/captured state, approved price, currency, livemode and purchase timing; accrues 20% of net of shipping/tax/discount; handles async success, duplicates and reordering, partial/full refunds, disputes, and refunds after payout. Existing webhooks untouched.
- `affiliate-portal` (authenticated affiliate) and `affiliate-admin` (admin) for reads, reconciliation, corrections and payout records.

**Secrets requested by name at setup, never invented:** `AFFILIATE_STRIPE_WEBHOOK_SECRET`, plus the enrollment price ID(s), seller account confirmation and sales-call URL stored in `affiliate_settings`.

**External affiliates:** a scoped affiliate-only account path that grants `/affiliates` without granting course access.

**Testing:** node/JSDOM regression coverage for attribution precedence, self-referral rejection, webhook idempotency and refund math; no real charges, no money movement, test-mode events kept out of live balances.

**Deployment:** backend migration and functions applied so you can inspect; the member frontend is not published.
