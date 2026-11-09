# Manual Barber Launch kit recovery

The admin order page offers a preview and a separate confirmation for one exact GHL enrollment order. It does not enable the automatic kit gate or send buyer messages. The public supplier page has no recovery action.

The server requires an authenticated admin, the global hair-system fulfillment hold to be explicitly false, the configured live Stripe seller, a fresh succeeded/captured/unrefunded/undisputed PaymentIntent and charge, exact matching GHL order/location/contact metadata, a current GHL order containing one of the two enrollment products, and a current GHL contact. Full-payment release requires the full offer amount and a paid GHL order. Installment release requires a current captured payment of at least $800, a partially paid GHL enrollment order, and the admin's explicit entitlement decision. A direct Stripe payment plan with no verified GHL enrollment order is not supported.

The admin must enter a complete US shipping destination, confirm it is for this purchase, record the evidence/source for that address, and explain the manual release. Any conflict with payment-attached shipping blocks. Preview reads all current evidence and existing hidden supplier rows, kit deliveries and order notification records without writes. It binds the admin, payment, charge, current contact, current GHL order revision, address, release basis, reason, six-item manifest and supplier action to a five-minute HMAC token. Confirmation repeats the reads and rejects a changed or expired preview.

Confirmation first inserts a permanent audit claim unique by GHL order and PaymentIntent. It rechecks existing rows, creates the supplier kit row with the existing manifest and stable raw GHL external-order ID, confirms visibility, inserts the existing unique kit delivery reservation, and sends through the existing Vlix relay. Any unknown outcome remains reserved or uncertain for human reconciliation. The operation never automatically resends. The supplier email subject remains `New Hair System Kit Order` and links to `/newtimes?order=<GHL order ID>`.

## Rollout prerequisites

1. Review and apply `drizzle/migrations/0009_manual_kit_recovery_claims.sql` through the repository's approved migration process. Confirm existing kit activation and delivery tables and restrictive order policy are present.
2. Restore authorized access to the production Supabase project and verify the function's existing Stripe/GHL credentials and global hold. Deploy the reviewed `hair-system-kit` function and admin site through the normal release process. Do not activate broad automatic fulfillment.
3. For each real buyer, obtain the exact GHL enrollment order, PaymentIntent and contact IDs, verify shipping provenance and the buyer's entitlement, then preview and review. Confirm each order separately. Reconcile any existing claim, order or delivery before considering another attempt.

No production database or supplier relay was used while preparing this patch.
