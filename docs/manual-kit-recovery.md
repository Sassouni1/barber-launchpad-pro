# Manual hair system kit entry

An authenticated admin enters the buyer's name, email, phone, complete shipping address, and optional kit notes on the admin orders page. The fixed six-item kit and supplier email are shown for review. **No GHL order, payment, subscription, or external provider lookup is required.** The entered facts are the source of truth. Preview reads for duplicates and makes no writes. Confirmation rechecks the same facts and duplicate state, creates one supplier row, reserves one supplier delivery, and uses the existing Vlix relay to send one email to New Times Hair.

The server records the authenticated admin ID, request UUID, exact entered fields, notes, address confirmation, preview facts, order row, delivery status, and provider message ID. Optional reason and address-source text are retained for audit but are not required essays. An unknown send outcome remains terminal for reconciliation; retries do not resend.

The database migration protects manually entered fields and the manual_source and supplier_kit designations against automated upserts, reconciliations, and deletes. Tracking, status, and supplier completion fields may still change. Unique normalized email and phone indexes cover manual, automatic, and legacy kit rows. The complete database-side duplicate lookup checks matching old kit rows and supplier notification/delivery records without a paginated API result cap. Existing duplicates must be reconciled before the migration can apply.

## Rollout

1. Review and apply drizzle/migrations/0009_manual_kit_recovery_claims.sql through the approved migration process. Inspect existing kit rows for email/phone index conflicts first. The migration is registered in the Drizzle journal.
2. Restore authorized production Supabase access. Deploy the reviewed function and admin site through the usual release path. Do not activate broad automatic fulfillment.
3. For each of the three buyers, confirm the exact entered name, contact details, shipping destination, and notes with Chris. Preview each entry and reconcile any existing kit, claim, or uncertain supplier send before confirmation.

This patch was developed and tested locally. It has not been deployed, and no real order or supplier message was created.
