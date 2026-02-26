

## Support Multiple QR Codes

Right now the page only shows `links[0]` and hides the create form once one QR exists. We'll update it to show **all** existing QR codes as a list of cards, plus a "Create New QR Code" button that reveals the creation form. Old QR codes are never touched -- each one keeps its own unique short code and redirect.

### Changes (single file: `src/pages/QRCodes.tsx`)

1. **Remove the single-link constraint** -- delete the `existingLink = links[0]` logic that gates between "show card" vs "show form"
2. **Add a `showCreateForm` state** -- toggled by a "Create New QR Code" button; resets to false after successful creation
3. **Render all QR links** -- map over `links` array, rendering a `QRLinkCard` for each one inside its own Card
4. **Add the "Create New QR Code" button** -- shown below the list (or as the primary CTA if no links exist yet), opens the inline creation form
5. **Add a label** (e.g. "My Instagram") next to each card so users can tell them apart

No database or hook changes needed -- the hooks already support multiple links. This is purely a UI update.

