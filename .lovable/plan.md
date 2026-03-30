

# Add Template Submissions to Admin

## What We're Building
1. Add an `approved` column to the `certification_photos` table (default `false`) -- for future use, won't affect frontend yet
2. In the **Member Detail Panel**, add a "Template Submissions" section showing that member's uploaded certification photos with timestamps and an Approve button
3. Create a new **Template Submissions** admin page (`/admin/templates`) that shows ALL submissions across all members, ordered by upload date (newest first), with member name, photo preview, date, and an Approve button
4. Add a sidebar link to the new page

## Technical Details

### Database Migration
- Add `approved` boolean column (default `false`) and `approved_at` timestamp to `certification_photos` table
- Admin UPDATE policy already exists via the `has_role` check, but we need to add one since currently admins can only SELECT, not UPDATE. Add an UPDATE policy for admins.

### Files to Change

**1. `src/pages/admin/Members.tsx`**
- After the "Completed Lessons" section (~line 639), add a "Template Submissions" section
- Fetch `certification_photos` for the selected member using supabase query in `MemberDetailPanel`
- Show each photo with thumbnail, filename, upload date, and an Approve/Approved button
- Approve button calls `supabase.from('certification_photos').update({ approved: true, approved_at: new Date() })`

**2. New file: `src/pages/admin/TemplateSubmissions.tsx`**
- Admin page with `DashboardLayout`
- Fetches all `certification_photos` joined with `profiles` (for member name/email), ordered by `uploaded_at desc`
- Table with columns: Member Name, Photo (thumbnail/link), Submitted Date, Status (Approved/Pending), Approve button
- Approve button updates the row

**3. `src/App.tsx`**
- Add route: `/admin/templates` -> `TemplateSubmissions` (protected, requireAdmin)

**4. `src/components/layout/Sidebar.tsx`**
- Add "Template Submissions" nav item in the admin section

