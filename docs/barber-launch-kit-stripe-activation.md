# Barber Launch full-kit activation checklist

Status: **draft code only**. Do not enable supplier delivery, backfill historical purchases, or send a live test email as part of code review.

## Verified read-only evidence

- The existing welcome workflow has four `Order Submitted` triggers, including two named `Barber Launch Hair System Mastery & Marketing`. All enter the same action path. The workflow variable picker exposes `Order ID`, and an `If / else` action offers `Order > Product > Is`.
- Two historical GHL order IDs each matched exactly one live Stripe PaymentIntent using `metadata['orderId']`. Both current PaymentIntents and charges were succeeded, captured, unrefunded, undisputed, USD 299,700 cents received, and held complete shipping. The PaymentIntent and charge metadata also carried the Barber Launch location and matching contact ID.
- Neither PaymentIntent had a Checkout Session or an immutable product/price ID. Both had the exact Stripe description `Barber Launch Hair System Mastery & Marketing ($2997)`. Neither had a phone number. A live controlled event still must prove that the workflow sends the real contact phone.
- The production admin's existing read-only diagnostic identifies the configured Stripe seller as `acct_1LMNKMI6LFtj88Bq`. It does **not** test server permission to search PaymentIntents by metadata. The draft `hair-system-kit` admin `dry_run` now provides a read-only search probe for that purpose after deployment.

## Required before activation

1. Confirm the actual GHL product ID behind the intended `Barber Launch Hair System Mastery & Marketing` entry. The condition picker shows duplicate display names; selecting by name alone is not enough.
2. In the existing welcome workflow, add an `If / else` branch with `Order > Product > Is` for that verified product, preserving every existing action. Put the **new** kit webhook action only on that branch. Do not reuse or modify the Meta CAPI action. Pass GHL `Order ID` and contact phone as explicit fields, plus the dedicated `x-kit-webhook-token` header. Check a controlled workflow execution with the kit activation gate disabled; capture the actual receiver fields without supplier delivery.
3. Apply the server-only kit migration, deploy the `hair-system-kit` function, and use its admin `dry_run` on a known historical order to prove that the **server's configured key** can search Stripe PaymentIntents. `dry_run` must report one bound payment and complete shipping, with zero writes or outbound messages. Historical orders must remain outside the activation cutoff.
4. Confirm the public `/newtimes` page displays a locally inserted test fixture with its exact order link, six kit contents, shipping, and tracking controls. Do not send a fake supplier email.
5. Only after the product branch and phone payload have been verified, set `KIT_PRODUCT_BRANCH_VERIFIED=true` and seed the activation singleton with a fresh cutoff and `enabled=true`. Use a new controlled paid purchase only with Chris's authorization for a live supplier email.

The receiver checks a unique Stripe search hit by GHL Order ID, retrieves the current PaymentIntent and charge, and requires matching order/location/contact metadata, the GHL Stripe application, exact offer description, live succeeded capture, at least $2,997 actually received, no refund or dispute, complete shipping, and a contact phone. A missing search result is retried briefly and then returns 503 without creating an order or sending. The workflow action's retry behavior is not yet verified, so the first controlled execution must confirm it or add a durable retry route before activation. Existing per-order storage and permanent supplier-send reservation prevent duplicate rows and first emails.
