

## Plan: Make Phone Number the Primary Client Identifier

Right now, phone number is optional and duplicate detection uses name + phone. The system should treat phone number as the main way to identify and track clients.

### Changes

**1. Update the rewards join page (`RewardsJoin.tsx`)**
- Make phone number required (marked with *)
- Make name optional (still collected but not required)
- Change the submit button to require phone instead of name
- Update placeholder text to make phone the primary field

**2. Update the edge function (`register-reward-client/index.ts`)**
- Make `client_phone` required instead of `client_name`
- Change duplicate detection to match on `user_id` + `client_phone` (instead of name + phone)
- Keep name as optional but encouraged

**3. Update the Add Client dialog in `Rewards.tsx`**
- Make phone the required field (with *) and move it above name
- Make name optional
- Update validation to require phone instead of name

**4. Update the hook (`useRewards.ts` > `useAddClient`)**
- Adjust the mutation to require `client_phone` and make `client_name` optional

### What stays the same
- Database schema (no migration needed — `client_phone` is already a text column, just needs the edge function/UI to enforce it)
- Actually, we need a migration to make `client_phone` NOT NULL and `client_name` nullable

**5. Database migration**
- `ALTER TABLE reward_clients ALTER COLUMN client_phone SET NOT NULL;`
- `ALTER TABLE reward_clients ALTER COLUMN client_name DROP NOT NULL;`
- Set a default for client_name so existing inserts don't break: `ALTER TABLE reward_clients ALTER COLUMN client_name SET DEFAULT '';`

### Technical detail
- Duplicate detection key becomes: `user_id` + `client_phone` (unique per specialist)
- Display in the rewards dashboard will show phone as the identifier, with name shown when available

