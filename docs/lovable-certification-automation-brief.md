# Lovable Brief: Barber Launch Certification Automation

Project: Barber Launch member portal, gold/black theme.

## Goal

Set up end-to-end certification handling for users who complete Barber Launch training. The app already has an admin "Template Submissions" / waiting approval flow backed by `certification_photos`. Those pending submissions are the people who need certificate review and fulfillment.

## Required App Changes

### 1. Collect Mailing Address During Certification

Add shipping/mailing address fields to the certification form where the user enters the name for their certificate.

Current component:

```text
src/components/certification/CertificationModal.tsx
```

Current edge function:

```text
supabase/functions/generate-certificate/index.ts
```

Fields to collect:

- Certificate display name
- Mailing recipient name
- Phone number
- Address line 1
- Address line 2, optional
- City
- State
- ZIP/postal code
- Country, default `US`

Validation:

- Require recipient name, phone, address line 1, city, state, ZIP, and country.
- Keep this responsive and aligned with the existing gold/black UI.

### 2. Persist Fulfillment Data

Create a fulfillment table instead of overloading `certifications`.

Suggested table: `certification_fulfillment_requests`

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `course_id uuid not null`
- `certification_id uuid references certifications(id)`
- `certification_photo_id uuid references certification_photos(id)`
- `certificate_name text not null`
- `certificate_url text`
- `recipient_name text not null`
- `phone text not null`
- `address_line1 text not null`
- `address_line2 text`
- `city text not null`
- `state text not null`
- `postal_code text not null`
- `country_code text not null default 'US'`
- `status text not null default 'pending_review'`
- `provider text`
- `provider_variant_id text`
- `provider_order_id text`
- `provider_order_status text`
- `estimated_base_cost numeric`
- `estimated_shipping_cost numeric`
- `estimated_tax numeric`
- `actual_total_cost numeric`
- `tracking_url text`
- `admin_note text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Suggested statuses:

- `pending_review`
- `approved_ready_to_order`
- `draft_order_created`
- `ordered`
- `shipped`
- `delivered`
- `blocked`
- `cancelled`

RLS:

- Users can insert/view their own fulfillment request.
- Admins can view/update all fulfillment requests.

### 3. Show Address/Fulfillment In Admin Waiting Approval

Update:

```text
src/pages/admin/TemplateSubmissions.tsx
src/pages/admin/Members.tsx
```

Admin should see, for each pending certification user:

- Name/email
- Course
- Uploaded proof/template photo
- Whether mailing address is complete
- Full mailing address
- Fulfillment status
- Admin note

Flag missing address clearly so Chris knows why fulfillment cannot happen.

When an admin approves a pending certification/template submission, mark the matching fulfillment request as `approved_ready_to_order` if the address is complete. If the address is missing, mark it `blocked` with note `missing_shipping_address`.

### 4. GHL SMS Notification To Chris

When a new `certification_photos` submission is created, notify Chris by SMS through the GHL API.

Chris phone:

```text
7276374672
```

SMS should include:

- Student name
- Student email
- Course
- Upload time
- Whether shipping address is complete
- Admin review link/path: `/admin/templates`

Use the existing Barber Launch GHL OAuth/integration pattern if possible:

```text
supabase/functions/ghl-oauth
supabase/functions/send-overdue-reminders
src/components/admin/GHLIntegration.tsx
```

Add a new Supabase edge function if needed:

```text
supabase/functions/notify-certification-submission/index.ts
```

Do not create GHL appointments. This is SMS notification only.

### 5. Fulfillment Provider Recommendation

Use Printful for automated print-and-frame fulfillment rather than VistaPrint.

Reason:

- VistaPrint is fine for manual poster printing, but it is not the cleanest automation target for direct print + frame + ship workflows.
- Printful supports API order creation and draft order review.
- Printful has framed poster products that can be shipped directly to the student, which avoids Chris manually receiving, framing, and reshipping certificates.

Preferred framed certificate product:

- Provider: Printful
- Product: Matte Paper Framed Poster With Mat (in)
- Variant: Black / 12x16
- Variant ID: `20256`
- Base product price observed from Printful catalog API on 2026-05-27: `$35.70`
- Shipping/tax are additional and must be calculated per address before order confirmation.

Lower-cost framed option:

- Provider: Printful
- Product: Enhanced Matte Paper Framed Poster (in)
- Variant: Black / 12x16
- Variant ID: `1350`
- Base product price observed from Printful catalog API on 2026-05-27: `$31.57`
- Shipping/tax are additional.

Plain print fallback:

- Provider: Printful
- Product: Enhanced Matte Paper Poster (in)
- Recommended size: 12x16 or 16x20, depending final certificate aspect ratio.

Important:

- Create Printful draft orders first.
- Do not auto-confirm paid orders until Chris approves the first live order and confirms costs.
- Store provider order IDs/status/tracking back into `certification_fulfillment_requests`.

### 6. Perfect Agent 2 Integration

A local agent is being set up under:

```text
/Users/chrissassouni/Desktop/Perfect Agent 2/agents/certification
```

It will:

- Poll pending `certification_photos` submissions.
- Block Chris's screen when a new submission appears.
- Block Chris again when a submission is over 24 hours old and unresolved.
- Send GHL SMS when configured.
- Later create Printful draft orders after address + certificate URL are available.

The app should expose enough structured data for the agent:

- `certification_photos.id`
- user name/email
- course id/name
- approval status
- certificate URL
- fulfillment request address/status

## Testing Requirement

Test as April through the admin view switcher:

1. Log in at `https://member.thebarberlaunch.com`.
2. Use the left sidebar `Switch View`.
3. Choose `Specific Member`.
4. Select April.
5. Verify certification flow from the member perspective.
6. Confirm the relevant navigation still works:
   - Hair System Training
   - Training Games
   - Marketing Mastery / Business Mastery
7. Confirm the address fields appear in the certification form.
8. Confirm the admin pending submission view shows address and fulfillment status.

## Live April Retest Finding

Observed on 2026-05-27 in April Johnson's live member view:

- The `Level 1 Cert` modal opens.
- It shows `You are certified!`.
- `Download` saves `certificate-April-Johnson.png`.
- `Regenerate` accepts `April Johnson` and shows `Certificate generated successfully!`.
- The regenerated download also saves successfully.
- Defect: the rendered certificate image is missing the student name and issued date.

Root cause found in live Supabase data:

- The downloaded certificate image is `2800 x 1867`.
- The live `certificate_layouts` row for the Hair System course has off-canvas coordinates:
  - `name_x = 3082`
  - `name_y = 1952`
  - `date_y = 3350`
- Because those values are outside the template dimensions, the edge function draws the name/date outside the visible certificate.

Required fix:

- Update the Hair System certificate layout row to coordinates that fit the current `2800 x 1867` template.
- Deploy the updated `generate-certificate` edge function so it falls back to safe visible coordinates if a future bad layout row is saved.
- Retest by regenerating April's certificate until the downloaded PNG visibly contains:
  - `April Johnson`
  - the current issue date
  - the existing Barber Launch certificate artwork

## Acceptance Criteria

- A student cannot request/receive physical certificate fulfillment without a valid mailing address.
- April's Level 1 certificate regeneration and download produces a PNG with the student name and issue date visible on the certificate.
- New pending certification submissions notify Chris by GHL SMS.
- New pending certification submissions are visible in Admin > Template Submissions with address/fulfillment details.
- Submissions older than 24 hours remain visible as unresolved and can trigger the local Certification agent blocker.
- Printful fulfillment is draft-first and no paid order is confirmed without Chris approval.
