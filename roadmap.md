# Roadmap

## Training certificate download repair
- [x] Open the working Level 1 preview from training; use the shared file saver in the generation dialog, without changing certification eligibility or directory enrollment.
- [x] Five file-saving regressions passed; signed-in desktop/phone training preview downloaded a verified existing PNG with certification/listing responses simulated and writes intercepted. Preview build passed; no member records changed, no publication. Actual member-specific eligibility and fresh certificate generation were not exercised.

## Member quiz detail note 1a56c9b5-84c0-4e0f-875f-f6e734b92c83
- [x] Show all quizzes and every dated attempt, grouped by course, alongside the selected member's name and email; preserve member-only read scope and shared pass rule.
- [x] Three focused tests and preview build passed; signed-in desktop/phone showed Suzie's 15 actual attempts with matching identity and dates, without overflow; no publication or member-data writes.

## Explicit supplier completion correction
- [x] Keep tracking saves in processing/current; explicit Completed and undo with shared optimistic actions and completion-based eight-day archive; undo/recompletion suppresses repeat in-app shipment notice.
- [x] Simplify package UI, deploy newtimes-orders through managed path; disposable first/second/late-third tracking, stale completion rejection, completion/undo, 40-day working-clock and eight-day completion-clock checks pass; remove disposable fixture.
- [x] 26 regressions, function dependency check and automatic preview builds pass; logged-out desktop/393px phone inspected without overflow or runtime errors. Frontend unpublished; authenticated admin hook shares tested reducer but admin browser flow not exercised.

## Additional supplier packages
- [x] Add scoped extra-package storage/validation and matching public/authenticated actions; preserve primary tracking, legacy archive timing, private details and reopen history.
- [x] Deploy only newtimes-orders through project-managed deployment; 20 focused/regression tests and Deno dependency check pass. Deployed disposable-order add-second/add-third, duplicate/stale rejection, confirmed edit/remove, Copy All/search and reopen pass; disposable record removed.
- [x] Inspect logged-out desktop/393px phone preview, unchanged primary after extras, cleared labels after reopen and no horizontal overflow/runtime errors; frontend unpublished. Managed deployment returns submitted source hash; independent live-source download and authenticated /admin/orders browser exercise unavailable/not performed.

## GHL kit supplier path
- [x] Inspect live schema/permissions and synchronized main baseline; real relay probe ready, but no payment-read contract advertised. GitHub connector source lookup fails with 401 Bad credentials.
- [x] Add isolated qualification/storage/reservation scaffolding, server-only disabled activation state and kit-only restrictive order reads; preview supplier deep-link/shipping change preserves controls.
- [x] Pass 14 network-disabled kit tests and 13 frontend/receipt regressions; verify real selected order plus desktop/mobile kit response fixture; deployed Chris admin diagnostics HTTP 200 inactive, manufacturer 403 and anonymous 401.
- [ ] Bind fresh GHL order/transaction/current-payment reader and enable purchase-to-email path (blocked: real relay payment-read contract unavailable; no guessed actions or evidence).
- [ ] Publish and verify real qualifying kit row through manufacturer session before activation (blocked: payment reads unavailable; frontend left unpublished; fixture-only kit rendering is not a real purchase verification).

## Chris-only live $1 verification
- [x] Add one-time server-authorized live checkout and conditional test-only supplier/receipt/SMS notices; normal checkout unchanged.
- [x] Pass 34 network-disabled fixture/regression tests and three function checks; deploy checkout/webhook/reconcile and request publication. Existing nine critical security findings remain; workspace permits publication.
- [x] Verify real Chris admin section on desktop/mobile, confirmation gating and no creation on load; no Start/payment/send performed. Chris/Codex retain unpaid session, payment, and post-payment checks; publication scheduled, completion not yet confirmed.

## Supplier-only historical recovery
- [x] Add admin-only single-order paid Stripe supplier dry run and explicitly confirmed supplier-only execution; preserve all buyer/CRM paths.
- [x] Pass 33 network-disabled fixture/regression tests and function dependency check; deploy reconcile only. Live unsigned/invalid-token checks return 401. No recovery or send performed; authorized order dry runs remain for Codex because the current tool session is signed out.

## Authoritative hair-system receipts and read-only order details
- [x] Add owner/admin-only paid Stripe receipt retrieval and consolidated multi-system receipts; preserve legacy receipts.
- [x] Store authoritative receipt snapshots for future paid orders without changing deliveries or holds.
- [x] Add admin email/date lookup with stored specifications, shipping and supplier attempts; keep diagnostics read-only.
- [x] Run 11 focused receipt/reconciliation tests, 25 isolated safety regressions and function type checks; automatic builds pass. Deploy four functions; real signed-in admin lookup and both Stripe-backed PDFs verified on desktop/mobile without writes or sends.
- [ ] Publish scoped receipt/admin UI (blocked: publishing deploys the whole preview, including unrelated previously unpublished work; file-scoped publication is unavailable).
- [ ] Verify Jan's owner-session /orders page (blocked: no authorized Jan session; real admin retrieval/PDF verified, owner/admin access rules tested).

## Supplier delivery production repair
- [x] Decouple supplier attempts from CRM failure; retain paid gates, channel claims, buyer behavior and holds.
- [x] Fix single-order read-only admin dry run and distinguish relay, OAuth, hold and attempt diagnostics.
- [x] Run 32 isolated regressions, Deno checks and automatic build; verify read-only UI on desktop/mobile; deploy webhook, checkout and reconcile without live database access or sends.
- [ ] Publish admin UI (blocked: stale security scan with unresolved findings; fresh database/security access requires separate authorization).
- [ ] Verify live relay sender acceptance and safety configuration (blocked: separate authorized live access; relay implementation absent from this repository).

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
- [x] My Links balance follow-up: show each connected member's real Stripe payout schedule and explain available-to-transfer balance (left unpublished)
- [x] Replace the My Links opening with the approved earnings and processing explanation; visually verify it exactly (left unpublished)

## Download and directory repair
- [x] Audit and repair training access before/after certification; real signed-in video verified on desktop/mobile, simulated certification/listing combinations and refresh event verified, failed-load retry recovered; no member records changed or frontend published. Actual token renewal remains unverified because the injected refresh attempt signed out.
- [x] Fix resource, content, marketing, certificate, Aion and support Save controls; verified real lesson/image downloads without navigation.
- [x] Add mobile-safe Download All image archive with location filenames; desktop and touch-mobile ZIP downloads verified.
- [x] Sierra Hannibal: valid ZIP 84045 was blocked by provider Access denied; replacement lookup deployed and live-verified, listing unchanged.

## Hair-system Stripe TEST mode (isolated)
- [x] Admin-only test checkout + test webhook + capture sink tables; live webhook now rejects test events
- [x] Hosted test checkout uses verified affiliate test key fallback (account-checked)
- [ ] Optional: HAIR_SYSTEM_STRIPE_TEST_WEBHOOK_SECRET + test endpoint for automatic webhook testing

## Meta Ads connection (Barber Launch Official 2895514127400266)
- [x] Admin: create PAUSED Meta campaign for a local draft (idempotent, re-checks Page access, no spend)
- [x] Admin: link existing PAUSED campaign after Meta confirms account/status; preview account, ID, status, customer
- [x] Reporting sync bound to linked Official campaigns; member results with honest empty/error states and last update
- [x] Admin states: local draft vs Meta PAUSED vs ACTIVE; "Mark ready (local)" labeled local-only
- [x] Page access needs Meta task proof (client_pages) or ownership; deployed
- [x] Server Meta token saved; account, permissions, client_pages, link, status and results reads verified live (temporary drafts removed)
- [x] Hourly results sync scheduled (server-held token)
- [ ] First real "Create PAUSED in Meta" press by Chris (not run by agent: it would add a campaign in Meta)
- [ ] Live ADVERTISE grant from a Page Barber Launch doesn't own (needs a real external member)
- [ ] Publish frontend after Chris reviews the preview
- [x] Recognize PROFILE_PLUS_ADVERTISE / PROFILE_PLUS_FULL_CONTROL as advertising proof (Vault Trading Academy Page 691048774091891); test + deploy managed-ad-social

## Agency Meta token lifecycle
- [x] Server-only encrypted credential store, centralized token reader for social/meta-admin/reporting, verified renewal, 6-hourly health check, admin status panel; 13 new + 54 existing tests pass; deployed.
- [ ] Blocked on Chris: save a fresh system-user token as META_ADS_ACCESS_TOKEN in Project Settings → Secrets, then press Check now on /admin/ads.

## Support inbox SMS alert to Chris
- [x] Member-only insert trigger + message-ID ledger + notify-support-message (same GHL alert path, Barber Launch location check); admin status/retry; admin inbox opens ?conversation= link.
- [x] Deployed; rollback rehearsal (member yes, admin reply/reaction/edit no, single claim); live test message from Chris's test member sent once (GHL message hA40V5lQGBAMwmeXjoqf), replay did not resend. Frontend link change unpublished.

## Member access by verified purchase
- [x] Access records, permanent history, auto-grant from verified live Stripe checkouts and paid hair-system orders; refunds/disputes revoke (switch OFF)
- [x] Signed-out visitors can no longer read course content; Aion chat requires sign-in
- [x] Admin Member Access page + server controls (grant/revoke/link with reason, Stripe re-check, guarded switch)
- [x] Audit: 1,093 Stripe charges read; 71 non-admin accounts matched to real purchases; GoHighLevel payments unreadable (token lacks payments scope)
- [x] Email confirmation on for new sign-ups (Chris approved); create page explains it
- [x] "Check my purchase" self-serve check for pending accounts
- [ ] Review the 36 accounts without a matched purchase (blocked: Chris's decision — link/grant/leave)
- [ ] Turn the access check on and verify live (blocked: review above)
- [x] Make course-files storage private with signed links; gate paid AI functions by access

## Purchase-gated access (Nov 22)
- [x] Server cutover: accounts created after 2026-11-22 03:10 UTC need verified purchase/admin grant (RLS + paid edge functions); pre-cutover accounts keep temporary access; full legacy gate stays off.
- [x] Course-files bucket private + signed links; old public URLs return 400 live; admin opens all 17 live (desktop+mobile).
- [x] /create: purchase checked server-side before any account (member-signup); open sign-up disabled; no match = no account + guidance; phone-only -> Support.
- [x] Published and verified live desktop + mobile.
- [ ] Move public/lesson-assets (85 files) + installation checklist PDF behind sign-in (not started)
- [ ] Vimeo domain-only playback (blocked: Vimeo account setting)

- [x] Chris 2026-11-22: every existing account (incl. 36 unmatched + manufacturer) keeps member access; only explicit admin revocation ends it; manufacturer gets member menu + Supplier Orders link.
- [x] Final verification without manufacturer login: all-111 DB decisions, rolled-back manufacturer JWT simulation, anon denial, course-files private, live publish confirmed

## Paid checkout account claim
- [x] member-checkout-signup: Stripe-verified live enrollment session as single-use proof, atomic claim binding to one new account, any login email, standard confirmation only; consumed payments excluded from checkout-email and self-check paths.
- [x] Rule tests, rolled-back claim rehearsal, real two-connection concurrency check, live denials (made-up, test-mode, unpaid real session); /create checkout flow on desktop/phone.
- [ ] Real paid buyer end-to-end (waits on the first real purchase; no test purchase or real buyer account made).
