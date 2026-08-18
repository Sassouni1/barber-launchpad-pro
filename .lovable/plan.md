# GHL OAuth: read-only diagnosis (no changes made)

## What the code actually sends

From `supabase/functions/ghl-oauth/index.ts` (`getAuthUrl`):

```text
https://marketplace.gohighlevel.com/oauth/chooselocation
  ?response_type=code
  &redirect_uri=<GHL_REDIRECT_URI secret, fallback https://member.thebarberlaunch.com/integrations/crm/callback>
  &client_id=<GHL_CLIENT_ID secret>
  &scope=contacts.readonly contacts.write conversations/message.write locations.readonly
  &state=<CSRF token>
```

Secrets confirmed present in the backend: `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_REDIRECT_URI`. Their **values are encrypted and cannot be read**, so the client ID actually sent at runtime is unverified. Everything below is conditioned on that.

## Answers

**1) Is the authorize URL and parameter set correct?**
Yes. `/oauth/chooselocation` with `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state` is the correct contract for a Private, Live, Sub-Account-targeted Marketplace app. No parameter is missing. `user_type` is not a supported authorize parameter; it is derived from the app's configured target user type.

**2) Could the client ID be wrong?**
This is the single most likely cause and it fits the symptom exactly. The observed behavior — same-tab load of `chooselocation` that instantly bounces to `app.gohighlevel.com/agency_dashboard?tab=summary` with no chooser, no `code`, and no `error` — is GHL's silent rejection path. It fires when the authorize request cannot be resolved to an installable app for the signed-in user. The most common trigger is sending the bare app ID (`6941fcbf392d3e2dded5676c`) instead of the full OAuth client ID (`6941fcbf392d3e2dded5676c-mppdz93j`). The suffix is part of the client ID, not a display artifact. Because the secret is write-only, we cannot confirm which form is stored.

Second candidate with the identical signature: a `redirect_uri` that differs from the registered one by even one character (trailing slash, `http` vs `https`, `www.`, different path case). GHL does not render an error page for a mismatch on this endpoint; it bounces.

Third candidate: a requested scope that is not enabled on the app. Our four scopes must each be checked on the app's scope list, notably `conversations/message.write` (slash form, not dot).

**3) Does the Marketplace app need extra settings for `chooselocation` to emit a code?**
Yes, three that are easy to miss:
- **Distribution type Private** requires the app to be explicitly shared with the agency/company ID that is installing it. If the signed-in agency is not on that list, the app is invisible to the authorize endpoint and the request bounces to the agency dashboard.
- **Target user type must be Sub-Account** and the redirect URI must be registered under the same client that issued the client ID. An app can hold more than one client credential set; only the one matching the redirect URI works.
- **Already-installed state.** If "Vlix Booking" is already installed on the agency but not on any sub-account, or the install was done from the agency side only, `chooselocation` can short-circuit back to the dashboard. A clean uninstall/reinstall from the sub-account level is the usual reset.

An install/authorization URL field is not required for a code to be emitted, but if one is set and points anywhere other than our canonical callback, it takes precedence and explains the redirect.

**4) Exact read-only checklist for Chris (verify, do not change yet)**

In the GHL Marketplace app "Vlix Booking":

| Field | Expected value |
| --- | --- |
| Client ID (full string, including suffix) | `6941fcbf392d3e2dded5676c-mppdz93j` |
| Redirect URI (exact, no trailing slash) | `https://member.thebarberlaunch.com/integrations/crm/callback` |
| Number of redirect URIs registered | Confirm the above is present and note any others |
| App status | Live |
| Distribution type | Private — record the exact agency/company IDs it is shared with |
| Target user type | Sub-Account |
| Scopes enabled | `contacts.readonly`, `contacts.write`, `conversations/message.write`, `locations.readonly` |
| Install / authorization URL field | Record whether it is empty or set, and its exact value |
| Client credentials sets | Note if more than one exists, and which one lists the redirect URI above |
| Current installs | Whether the app shows as installed on the agency and/or on any sub-account |

Also record, from the browser during a failed attempt: the **full authorize URL** in the Safari address bar before it bounces (query string included, `client_id` and `redirect_uri` in particular). That single capture confirms or rules out causes 2 and 3 immediately, and it is the piece of evidence we currently lack.

## Nothing was changed
No code, database, secret, or deployment change was made in this pass.
