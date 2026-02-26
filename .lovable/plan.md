

## Add Referral Tracking to Rewards Tracker

Track when existing clients refer new ones, with tiered free service rewards based on total referrals.

### How It Works

When a new client is added (manually or via self-signup), the member can mark which existing client referred them. The referring client earns credit toward tiered rewards:

- **1 referral** -- Small reward (e.g. free beard trim)
- **3 referrals** -- Medium reward (e.g. free haircut)  
- **5 referrals** -- Big reward (e.g. free full service)

The tiers are stored in an admin-configurable `app_settings` row so they can be adjusted later.

### Database Changes

1. **Add `referred_by_client_id` column** to `reward_clients` table (nullable UUID, self-referencing FK). This tracks which existing client referred each new client.

2. **Add `app_settings` row** for `referral_tiers` with value like:
   ```json
   {
     "tiers": [
       { "count": 1, "reward": "Free Beard Trim" },
       { "count": 3, "reward": "Free Haircut" },
       { "count": 5, "reward": "Free Full Service" }
     ]
   }
   ```

3. **Add `referral_redeemed_count` column** to `reward_clients` (integer, default 0) to track how many referral rewards they've already claimed.

### Frontend Changes

**`src/hooks/useRewards.ts`**:
- Extend `useRewardClients` query to include referral count (count of other clients where `referred_by_client_id = this client's id`)
- Add `useReferralTiers` hook to fetch tier config from `app_settings`
- Add `useRedeemReferralReward` mutation to increment `referral_redeemed_count`

**`src/pages/Rewards.tsx`**:
- In the "Add Client" dialog (and self-signup flow), add an optional "Referred by" dropdown listing existing clients
- On each client card, show referral count and their current tier/reward earned
- Add a "Claim Referral Reward" button when they've hit a new tier they haven't redeemed yet
- Display referral stats in the stats bar (total referrals alongside total clients / rewards given)

**`src/pages/RewardsJoin.tsx`** (self-signup page):
- No changes needed here since the member assigns the referrer on their end after the client signs up

### Technical Notes

- Referral count is computed by counting rows in `reward_clients` where `referred_by_client_id` matches the client's ID and the client belongs to the same member (`user_id` match)
- Tier progression: if a client has 3 referrals and has redeemed 1 tier reward, they can claim the 3-referral tier reward next
- The `referred_by_client_id` FK is scoped to the same `user_id` to prevent cross-member referral assignments

