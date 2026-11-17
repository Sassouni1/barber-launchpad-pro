# Manual individual hair-system orders

The admin orders page now has a separate form for one skin hair system. The admin enters the recipient, confirmed shipping destination, exact item and variant, optional email/phone, optional supplier cost, and optional notes. Preview is read-only and confirmation creates a **pending** normal order, reserves one supplier delivery, and sends the existing **New Hair System Order** email through the established relay to New Times. The email links to the saved order UUID. No checkout, charge, buyer receipt or CRM message is created by manual confirmation; existing tracking and fulfillment notifications remain in place.

The entry preserves literal variant text such as `#2 FRO` or `dark black`. Cost is stored only if entered. Unknown cost remains unknown on the supplier page. The kit path and its fixed six items, claims and payment checks are unchanged.

## Duplicate scope and intentional repeats

An initial manual order is identified by normalized recipient, shipping destination, item, variant and quantity. Repeated clicks, a refreshed browser request UUID and concurrent confirmations cannot place another initial order. The complete database lookup checks matching manual and normal orders, claims, deliveries and supplier notifications. Ambiguous or unreadable results block confirmation. An unknown send remains permanently reserved for reconciliation, never automatic resend.

For a genuinely **new later order** with identical specifications, the admin must explicitly confirm the repeat and reference the most recent sent manual order UUID. The server verifies that parent and allows one child per parent, using a unique database claim. Each later repeat references the preceding sent order. A different variant or destination is a separate intent, but a matching normal checkout order triggers reconciliation. This scoped rule may require manual reconciliation of two legitimately distinct same-day orders before entry; it favors duplicate prevention.

The existing `manual_source` trigger prevents automated replacement or deletion of entered identity, shipping, notes and line items. Migration 0011 also protects the individual designation, item, variant, quantity, color and optional cost. Supplier tracking, status and completion remain editable.

## Rollout

Review existing rows and apply `drizzle/migrations/0011_manual_individual_orders.sql` through the approved migration process. Deploy the corresponding `hair-system-kit` Edge Function and admin site together. The current production Edge Function may reject the new action until updated. Keep automatic fulfillment and supplier notification workflows enabled; an active `hair_system_fulfillment_hold` or unreadable hold blocks this manual path. Verify authorization, preview, duplicate state, resulting pending row and provider message ID in the authorized environment before real use.

This change was tested with local fixtures only. No real orders, supplier emails, customer notifications or payments were made.
