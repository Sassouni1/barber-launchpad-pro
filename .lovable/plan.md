

# Fix GHL Contact Resolution + Use Membership Phone

## Summary
Update the `send-overdue-reminders` edge function to:
1. Look up GHL contact by **email** first (more reliable match)
2. If not found, create the contact in GHL using profile data
3. Always send the SMS to the **phone number from the profiles table** (their membership number), regardless of what's stored in GHL

## Change: `supabase/functions/send-overdue-reminders/index.ts`

Add a `resolveGhlContactId` helper function before the SMS send block:

1. **Search by email**: `GET https://services.leadconnectorhq.com/contacts/search/duplicate?email={email}`
2. **If not found, create contact**: `POST https://services.leadconnectorhq.com/contacts/` with `{ firstName, lastName, phone, email }` from the profiles table
3. **Use returned `contactId`** in the `POST /conversations/messages` call
4. **Set `phone` in the message body** to the membership phone from profiles — ensures delivery goes to the number they registered with, not whatever GHL might have on file

The GHL API v2 `/conversations/messages` endpoint accepts a `contactId` plus explicit delivery fields. We pass the membership phone so even if GHL has a different number, the SMS goes to the right place.

Single file change, ~40 lines added to the existing edge function.

