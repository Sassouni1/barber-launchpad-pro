# Can a Stripe test charge verify the live hair-system pipeline? (Assessment only)

## Short answer
No. There is no isolated test-mode hair-system checkout today, and one cannot be used safely right now without code/config changes.

## What the project actually uses
- The order page loads Stripe with one publishable key: the live `pk_live_...` key (Invasion Digital Media).
- Checkout, webhook and reconcile all use one secret key resolver: `HAIR_SYSTEM_STRIPE_SECRET_KEY`, else `STRIPE_SECRET_KEY` — no test-key branch.
- The hair-system webhook is registered on the live endpoint and verifies with the live signing secret. A test-mode event would fail the signature check.
- The webhook records `livemode` but does not branch on it — so if a test event ever got in, it would run the real pipeline.
- Supplier email is hard-locked to `sales30@newtimeshair.com`; buyer receipt and SMS go through the same live Vlix/GHL relay. No sandbox recipient exists.
- The separate affiliate test key (`AFFILIATE_STRIPE_TEST_SECRET_KEY`) is only used by the affiliate flow, not hair systems.

## Why a test card on the live page fails
Stripe test cards (4242...) are rejected by live keys. You cannot "temporarily test" the current live page without real money.

## What a safe test path would require (not done)
1. Test-mode checkout route using a test key and test prices.
2. A separate test-mode webhook endpoint and signing secret.
3. A `livemode=false` branch that sends supplier/buyer messages only to an internal address/phone — never sales30 or buyers.
4. Keep test orders out of receipts and supplier lists.
Even then, it proves code behavior, not the live account, live webhook or live supplier inbox.

## Cheapest real alternative
One real $210 live order by Chris on his own account, then refund. Caveat: it sends a real production sheet to the supplier (must tell them to ignore it) and Stripe fees are not returned on refund.

## Limits of this assessment
Based on source code only; live Stripe dashboard webhook list and secrets were not read. Nothing was changed or sent.
