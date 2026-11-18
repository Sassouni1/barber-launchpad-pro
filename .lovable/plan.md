# Diagnose "can't confirm advertising access" for Page 822371197628991 (read-only)

## What is already established
- Saved result for this Page (checked 01:01:12 UTC): status `error`, no request timestamp, connection `connected`. No partner request was sent.
- In the live code, this exact message only appears in one case:
  - The Page-token reads worked: the ownership read did not show Barber Launch, and the Page's partner list loaded without Barber Launch on it.
  - The Barber Launch server-side read of `GET /1832826473434326/client_pages` failed. The grant then stops before any POST.
- So the failed prerequisite is the server-token `client_pages` read. The Page token, Page selection and full-control check all passed.
- `META_ADS_ACCESS_TOKEN` is configured by name. Its value was not read. This path saves no Meta error code, and the function logs only show a boot line. So the code isn't recorded yet. It will be one of these:
  - `-1`: the token is blank or invalid after trimming.
  - `190`: the token is expired or invalid.
  - `10`, `200`–`299` or `100`: missing `business_management` permission or business access.
  - `4`, `17`, `32`, `613` or `80001`: rate limit.
  - HTTP `0`: Facebook could not be reached.

## Step to get the exact code (read-only, needs your approval)
1. Sign in the preview as the dedicated Meta Review member (an approval card will name the account). Call `managed-ad-social` once with the existing read-only `probePageOwnership` action. It makes no database writes and no POST to Meta.
2. Report only the sanitized `clientTasks` result (ok, HTTP status, Meta code and message) and the `agencies` result (ok, listsBarberLaunch). No tokens, no other clients' Page names or IDs.
3. If `clientTasks.ok` is true now, the earlier failure was temporary. Report that and suggest pressing Check again.

## Fix by result (you apply; nothing changed here)
- **Code `-1` or `190`:** create a new long-lived System User token in Business 1832826473434326. Give it `business_management` and `ads_read`/`ads_management`, and assign it to the business. Put it in Project Settings -> Secrets as `META_ADS_ACCESS_TOKEN`. No redeploy is needed.
- **Code `10`, `200`–`299` or `100` (permission):** give the token's System User admin access to the business plus `business_management`. Then replace the secret as above.
- **Rate limit or HTTP `0`:** wait, then have the member press Check again. No change needed.

After any fix, the member presses Check again. Give advertising access sends one ADVERTISE request only when Barber Launch is still not listed.
