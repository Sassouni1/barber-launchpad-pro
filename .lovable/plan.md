

# Smart Order Matching with Fallback Chain

## Overview
Update the receive-order backend function to use a 3-tier matching strategy so orders always get linked to the right user, even when the UTM parameter is missing or the email doesn't match exactly.

## Matching Priority

```text
Priority 1: UTM user_id (direct, deterministic match)
    |
    v  (not found)
Priority 2: Exact email match
    |
    v  (not found)
Priority 3: Name-based fuzzy match
```

## How Name Matching Works

When both UTM and email fail, the function will:

1. Extract first name and last name from the incoming order (GHL may send `name`, `full_name`, `first_name`/`last_name`, etc.)
2. Query all profiles and score them by how well the name matches:
   - **Exact full name match** (case-insensitive) = highest confidence
   - **First AND last name both appear** in the profile's `full_name` = high confidence
   - **Last name only match** = medium confidence (last names are more unique than first names)
   - **First name only match** = low confidence (too common, skip this)
3. Only use the name match if there's exactly **one** strong match (full name or first+last). If multiple profiles tie or confidence is too low, the order is saved without a user link (just like today) so nothing gets misattributed.

## Technical Changes

**File:** `supabase/functions/receive-order/index.ts`

- Parse incoming name fields more thoroughly: `body.first_name`, `body.last_name`, `body.name`, `body.full_name`, `body.Name`
- After email fallback fails, add Priority 3 block that:
  - Normalizes names (lowercase, trim)
  - Queries profiles table for potential matches
  - Scores and selects the best match only if confidence is high
  - Logs the match method as `name_fuzzy` for debugging
- No database or frontend changes needed

## Safety Rails

- Name matching only triggers if UTM and email both fail
- Requires at minimum a last name match (first-name-only matches are ignored -- too many "John"s)
- If multiple profiles match equally, no match is made (avoids wrong attribution)
- All matching decisions are logged for easy debugging

