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
- [ ] Turn on the automatic payout scheduler (blocked: release timing choice + live setup checks)
