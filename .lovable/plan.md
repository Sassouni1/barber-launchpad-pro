

# GHL OAuth Integration for Barber Launchpad

## Summary
Replace the current static GHL_API_KEY/GHL_LOCATION_ID approach with a full OAuth flow where the admin clicks "Connect GHL," logs in, picks a location, and tokens are stored encrypted with automatic refresh. Modeled after the Command IQ implementation.

## Database Changes (4 migrations)

**1. `app_secrets` table** — encrypted token storage
- Columns: `id` (uuid PK), `secret_value` (text, encrypted), `created_at`
- RLS: no public access, only used via security definer functions

**2. `ghl_oauth_tokens` table** — tracks connected locations
- Columns: `id`, `location_id` (text, unique), `location_name` (text), `organization_id` (text), `access_token_id` (uuid FK to app_secrets), `refresh_token_id` (uuid FK to app_secrets), `expires_at` (timestamptz), `created_at`, `updated_at`
- RLS: admin-only read, no public access (edge functions use service role)

**3. `store_encrypted_token` RPC** — security definer function
- Takes `token_value text`, inserts into `app_secrets`, returns the UUID
- Uses `pgcrypto` extension with a server-side encryption key (derived from `SUPABASE_SERVICE_ROLE_KEY` or a dedicated secret)

**4. `decrypt_token` RPC** — security definer function
- Takes `token_id uuid`, returns decrypted text
- Both RPCs are `SECURITY DEFINER` so edge functions can call them via service role

## Edge Functions

**1. `ghl-oauth/index.ts`** — handles the OAuth lifecycle
- `getAuthUrl`: builds `marketplace.gohighlevel.com/oauth/chooselocation` URL with `client_id`, `redirect_uri`, scopes, and HMAC-signed `state`
- `exchangeToken`: receives `code` from callback, exchanges at `services.leadconnectorhq.com/oauth/token`, stores encrypted tokens in DB, fetches location name
- `refreshToken`: called by other functions when token is expired
- `disconnect`: deletes token record and associated secrets
- `getConnectedLocations`: returns list of connected locations for the admin UI

**2. Update `send-overdue-reminders/index.ts`**
- Remove `GHL_API_KEY` / `GHL_LOCATION_ID` env var usage
- Add `getAccessToken()` helper that reads from `ghl_oauth_tokens`, checks expiry, auto-refreshes if needed, returns decrypted access token + location ID
- Use the OAuth token for all GHL API calls

## Frontend Components

**1. `src/lib/oauthPopup.ts`** — popup polling utility
- Opens popup to GHL OAuth URL
- Polls popup URL every 400ms for callback path
- Extracts `code` and `state` params, returns them

**2. `src/pages/GHLCallback.tsx`** — OAuth callback page
- Minimal page at `/integrations/ghl/callback`
- Displays "Connecting..." while the popup polling picks up the URL

**3. `src/components/admin/GHLIntegration.tsx`** — admin UI
- "Connect GHL" button that triggers the OAuth popup flow
- Shows connected location name + "Disconnect" button when connected
- Placed in the admin dashboard or a new admin settings area

**4. Route addition in `App.tsx`**
- Add `/integrations/ghl/callback` route for the OAuth callback page

## Secrets Changes
- **Keep**: `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET` (already stored per user's description — though currently named `GHL_API_KEY`; we'll need to add `GHL_CLIENT_ID` and `GHL_CLIENT_SECRET` as new secrets)
- **Remove after migration**: `GHL_API_KEY`, `GHL_LOCATION_ID` (replaced by OAuth tokens in DB)

## Flow Diagram

```text
Admin clicks "Connect GHL"
       │
       ▼
ghl-oauth (getAuthUrl) → builds OAuth URL
       │
       ▼
Popup opens → marketplace.gohighlevel.com/oauth/chooselocation
       │
       ▼
User logs in, picks location → redirects to /integrations/ghl/callback?code=...
       │
       ▼
oauthPopup.ts detects callback → extracts code
       │
       ▼
Frontend calls ghl-oauth (exchangeToken) with code
       │
       ▼
Edge function exchanges code for tokens → encrypts & stores in DB
       │
       ▼
send-overdue-reminders reads tokens from DB → auto-refreshes if expired
```

## Technical Details

- Scopes requested: `contacts.readonly`, `contacts.write`, `conversations/message.write`, `locations.readonly`
- Token refresh: access tokens expire ~24h; refresh handled automatically before each GHL API call
- Encryption: `pgp_sym_encrypt` / `pgp_sym_decrypt` from `pgcrypto` extension using a dedicated encryption key stored as an edge function secret (`GHL_ENCRYPTION_KEY`)
- The `GHL_CLIENT_ID` value is the marketplace app ID the user already provided (`6941fcbf392d3e2dded5676c-mj9bogbp` — this is the client ID, not a location ID)

