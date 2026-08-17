# Facebook OAuth failure — read-only diagnosis

No code, secrets, config, data, or Meta settings were changed.

## 1. Exact redirect URI sent to Meta

`supabase/functions/managed-ad-social/index.ts` line 46 hardcodes:

```text
https://member.thebarberlaunch.com/integrations/facebook/callback
```

The authorize URL built at line 84 is:

```text
https://www.facebook.com/v19.0/dialog/oauth
  ?client_id=<FACEBOOK_APP_ID>
  &redirect_uri=https%3A%2F%2Fmember.thebarberlaunch.com%2Fintegrations%2Ffacebook%2Fcallback
  &state=<uuid>&response_type=code
  &scope=pages_show_list%2Cpages_read_engagement
```

`FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` both exist as Edge secrets (confirmed by name).

## 2. Callback route protection / new-tab behavior

`src/App.tsx` line 130: the route is wrapped in `ProtectedRoute`.

`src/components/auth/ProtectedRoute.tsx`: when `user` is null it renders `<Navigate to="/login" ...>`. It also redirects to `/reset-password` when a forced reset is flagged, and to `/agreement` when the agreement is unsigned.

`FacebookConnectButton.tsx` (lines 32-39) always opens OAuth via `window.open(..., '_blank')`, i.e. a new top-level tab.

Consequence: the new tab is a normal same-origin browser tab, so the Supabase session in localStorage is shared and the member is normally still authenticated. But if that browser context has no session (different browser/profile, private window, session expired, or a pending agreement/password-reset flag), the callback lands on `/login` (or `/agreement`) and the `?code=` is discarded — the code is single-use, so retrying the same link then yields the "link is missing or already used" error in `FacebookCallback.tsx` (lines 36-40). This is a real failure path but it happens *after* Facebook redirects, not on Facebook's own screen.

## 3. Does the redirect URI match the deployed domain and route?

Yes for the primary domain:
- `GET https://member.thebarberlaunch.com/integrations/facebook/callback` → HTTP 200 (SPA served, route exists).

Mismatch for the alias:
- `GET https://barber-launchpad-pro.lovable.app/integrations/facebook/callback` → HTTP 302 (redirect, does not serve the route directly).

So a member who starts the flow while sitting on the `.lovable.app` alias or on an `id-preview--*.lovable.app` preview is sent to Facebook with a `member.thebarberlaunch.com` redirect. If Meta accepts it, they get bounced to the production domain, where their session may not exist — again losing the code.

## 4. Meta App settings that must be verified (the likely cause)

The grey/broken screen after pressing Continue is Facebook-side, which points at app configuration rather than app code:

1. Facebook Login → Settings → **Valid OAuth Redirect URIs** must contain the URI byte-for-byte, including the trailing path and no trailing slash:
   `https://member.thebarberlaunch.com/integrations/facebook/callback`
2. **App Mode**: if the app is in Development, only users with an App Role (Admin/Developer/Tester) can complete login. Every other member sees a failure screen. Live mode requires the app to have completed the required verification.
3. Settings → Basic → **App Domains** must include `member.thebarberlaunch.com`, and a Website/Site URL platform entry for `https://member.thebarberlaunch.com`.
4. **Permissions**: `pages_show_list` and `pages_read_engagement` are Advanced-Access permissions. In Live mode without App Review approval, non-role users are refused. Also confirm the "Facebook Login" product is actually added to the app and that "Client OAuth Login" + "Web OAuth Login" are enabled.
5. Business verification / app not restricted or in a "development-only" restricted state.
6. Graph API version: the app must still allow v19.0 (older versions get deprecated and return an error page).

## 5. Can Meta configuration be inspected from this project?

No. This project has no Meta admin API access — only `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` values, which are write-only secrets here and are not readable.

Unverified from here, and must be checked by a human in the Meta App Dashboard:
- the exact contents of Valid OAuth Redirect URIs
- App Mode (Development vs Live)
- App Domains / Website platform entries
- App Review status of `pages_show_list` and `pages_read_engagement`
- whether the App ID in the secret is the same app being inspected
- the exact Facebook error text/code on the grey screen (the URL query string on that screen usually contains the reason)

Also unverified: `managed-ad-social` returned **no edge function logs** in the current retention window, so no recent server-side invocation of `getConnectUrl`/`completeConnection` could be examined.

## Fastest next diagnostic (no changes)

Reproduce the failure and capture the full URL of Facebook's grey screen plus any `error_code`/`error_message` in it. That single string identifies whether it is a redirect-URI mismatch (error 191), a mode/role restriction, or a permission/review block.
