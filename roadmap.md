# Roadmap

- [x] Rework Orders page: statuses removed, receipts-only view for tax purposes
- [x] Per-order "Receipt" PDF download + "Download All" zip (verified in preview: page renders, PDF + zip download correctly)
- [x] Split Bonus Earnings into two menu items/pages: /affiliates and /content-rewards (old /bonus-earnings redirects, ?tab=content -> /content-rewards)
- [x] Payout card: real loading/error states, works without affiliate enrollment, honest "automatic payments are not active" copy
- [ ] Live signed-in verification of the two pages (blocked: test sign-in declined)
- [x] Move Bonus Earnings out of Growth Tools into its own top-level expandable menu item (Sidebar + MobileNav) with Affiliate Program and Content Rewards as its only children
- [x] Referral page: truthful call-requested status, single-use checkout intent, allowlisted redirect domains, rate-limited idempotent checkout
- [x] Fixed stylesheet font import that broke the build/styling on the referral page
- [x] Move Bonus Earnings menu block above Get Support (after Level 1 Cert) in Sidebar and MobileNav
- [x] Payout dispatcher: test/live + currency isolation, atomic per-affiliate balance reservation, worker-bound release, reconciliation of ambiguous sends, non-mutating dry run, auto-resuming holds
- [x] Enrollment checkout configured live: Invasion Digital Media seller verified, $3,000 product/price created, signed webhook endpoint + vault-stored signing secret, checkout enabled (verified by loading a real live Checkout page, then expiring it; no charge)
- [x] Removed the misleading "you stay credited" messaging on the affiliate page, referral page and intake response
- [x] Turn on the automatic payout scheduler: release timing = 7-day hold from verified payment time, auto payouts + hourly scheduler enabled, platform transfer check passed, 7-day hold verified by self-erasing SQL test, real scheduler invocation returned 0 enqueued / 0 sent
- [x] Payout card now states the real rule: sent 7 days after the payment clears, bank arrival on the recipient's own Stripe schedule
- [x] Webhook: reject void referrals on the direct client_reference_id match too (email path already does)
- [x] Webhook: reconcile transfer state against Stripe before marking sent/paid; never treat transfer.created as bank receipt; preserve partial/full reversals
- [x] Recurring payout dispatcher with master switch OFF; connected-account bank payout monitoring
- [x] Dispatcher: move enqueue/claim/writes after the dry-run return; regression test with release_timing set
- [x] Dispatcher: force a Stripe lookup before resend whenever reconciliation/reservation state persists
- [x] Isolated Stripe test-mode end-to-end affiliate verification (checkout -> signed event -> $600 commission -> 7-day hold -> Connect transfer -> connected-account bank payout -> refund adjustment)
- [x] Certification SMS alerts to Chris: template submission, install submission, certification unlocked, directory listing request, certificate-holding photo
- [x] Add and locally verify the persistent mobile-safe “Current total” bar throughout the hair-system order flow
- [x] Publish and visually verify the “Current total” bar on the live member site

## Hair system paid-order notifications (deployed, awaiting secrets)
- Signed webhook: `hair-system-stripe-webhook` (checkout.session.completed + async_payment_succeeded).
  URL: https://ynooatjtgstgwfssnira.supabase.co/functions/v1/hair-system-stripe-webhook
- Blocked on secrets: `HAIR_SYSTEM_STRIPE_WEBHOOK_SECRET`, `HAIR_SYSTEM_SUPPLIER_EMAIL`.
- Delivery audit: `public.order_notifications` (per order/channel), `public.hair_system_webhook_events` (per Stripe event).
- [x] Implement, visually verify, deploy, and publish the approved persistent floating Aion assistant.
- [x] Fix stale public card/QR base URL (barber-launchpad-pro.lovable.app -> member.thebarberlaunch.com) in BusinessCardSetup.tsx and QRCodes.tsx
- [x] Hide Custom Hair Systems: removed Sidebar/MobileNav menu entries and the /custom-hair-system route (page + edge function preserved for later release)
- [x] Publish safe production version and verify https://member.thebarberlaunch.com/card/yoKiq1Sw (Valerie Prieto, The Glam Rock Salon)
