# Barber Launch full-kit activation checklist

Status: **inactive until the Stripe event route and supplier page are verified**. Do not backfill historical purchases or send a live test email as part of code review.

## Verified read-only evidence

- The existing welcome workflow has four `Order Submitted` triggers, including two named `Barber Launch Hair System Mastery & Marketing`. All enter the same action path. The workflow variable picker exposes `{{order.id}}` and `{{contact.phone}}`. These tokens were inspected in an unsaved webhook draft, not verified in a live payload.
- The product catalog identifies the $2,997 enrollment as `69c04272e1fa5f9772b8a7ea` and the older $1,997 enrollment as `69124b3bff3e41840f4d4b2d`. Chris approved automatic kit release for a fully paid purchase of either product. Existing global-product triggers remain unchanged. The receiver uses fresh Stripe payment evidence after the shared workflow path, with exact purchase descriptions and separate full-payment thresholds for these two offers.
- Two historical GHL order IDs each matched exactly one live Stripe PaymentIntent using `metadata['orderId']`. Both current PaymentIntents and charges were succeeded, captured, unrefunded, undisputed, USD 299,700 cents received, and held complete shipping. The PaymentIntent and charge metadata also carried the Barber Launch location and matching contact ID.
- Neither PaymentIntent had a Checkout Session or an immutable product/price ID. Both had the exact Stripe description `Barber Launch Hair System Mastery & Marketing ($2997)`. Neither had a phone number. A live controlled event still must prove that the workflow sends the real contact phone.
- Historical $1,997 GHL orders carried product ID `69124b3bff3e41840f4d4b2d`. Two matched unique Stripe PaymentIntents with the exact description `Barber Launch Hair System Mastery & Marketing ($1997)`. One fresh succeeded, fully captured $1,997 PaymentIntent and charge had complete matching shipping; another paid example had no shipping. Incomplete shipping must remain held for correction.
- The production admin's existing read-only diagnostic identifies the configured Stripe seller as `acct_1LMNKMI6LFtj88Bq`. It does **not** test server permission to search PaymentIntents by metadata. The draft `hair-system-kit` admin `dry_run` now provides a read-only search probe for that purpose after deployment.

## Signed Stripe event route

The GHL Link to Pay enrollment creates a Stripe PaymentIntent directly. The site's existing signed Stripe webhook can receive `payment_intent.succeeded` alongside its existing Checkout Session events. It filters the event to the Barber Launch location, GHL Stripe application and exact enrollment description. It then retrieves the current PaymentIntent and expanded charge by the signed event's ID, reads the linked GHL contact's phone with the already configured server-side GHL key, and runs the existing kit payment, shipping, order and delivery checks. This path does not change any GHL trigger, product, workflow action or secret.

## Required before activation

1. Deploy the updated existing `hair-system-stripe-webhook` function and add only `payment_intent.succeeded` to that Stripe endpoint's event subscription. Preserve its two Checkout Session events and signing secret. Confirm a historical GHL enrollment event is recognized while the kit gate is inactive, with zero writes or outbound messages.
2. Confirm the deployed function can re-read the current PaymentIntent and charge by ID and retrieve the linked GHL contact's phone using the existing server-side key. Historical orders remain outside the activation cutoff.
3. Confirm the public `/newtimes` page displays a local test fixture with its exact order link, six kit contents, shipping, and tracking controls. Do not send a fake supplier email.
4. Only after the signed event, current payment read, contact phone and supplier page are verified, seed the activation singleton with a fresh cutoff and `enabled=true`. Use a new controlled paid purchase only with Chris's authorization for a live supplier email.

The receiver recognizes only the two observed GHL enrollment purchase descriptions. It re-retrieves the PaymentIntent and charge identified by the signed Stripe event, and requires matching order/location/contact metadata, the GHL Stripe application, the exact Stripe description, live succeeded capture of that offer's full $1,997 or $2,997 price, no refund or dispute, complete shipping, and a GHL contact phone. A $500/$800/$1,000 payment, unrelated purchase, or incomplete shipping never creates a supplier order or email automatically. Direct Stripe sales-call payment plans are a separate flow. Transient reads return 503 so Stripe can retry. Existing per-order storage and permanent supplier-send reservation prevent duplicate rows and first emails. An uncertain GHL send is held for manual reconciliation rather than automatically re-sent.
