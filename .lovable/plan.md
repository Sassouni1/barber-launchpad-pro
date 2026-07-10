## Plan

You’re right: the name-entry certification flow already exists in `Level1CertModal`; the course page got wired to the lighter `CertificationSection` instead, which is why the right panel looks like a static finished certificate/checklist area.

### Fix

1. **Use the existing `Level1CertModal` from the lesson checklist**
   - Change the **Level 1 Certification** item in `Courses.tsx` so clicking it opens the existing `Level1CertModal`.
   - That restores the old flow with requirements, photo upload, and the certificate-name modal.

2. **Stop rendering the wrong right-side certificate panel for that checklist item**
   - Remove/disable the inline `CertificationSection` panel from the course page selection state.
   - The right-side panel should not replace the real certification modal flow.

3. **Keep the sidebar Level 1 Cert behavior unchanged**
   - Sidebar already opens `Level1CertModal`; don’t break that.

4. **Update the checklist copy**
   - Replace the misleading static text “Complete all lessons to unlock” with clearer copy like:
     - “Open certification checklist”
   - This avoids implying the certificate is automatically done just because lessons are complete.

5. **Verify desktop + mobile**
   - Desktop: clicking **Level 1 Certification** from `/courses/hair-system` opens the existing modal.
   - Mobile: tapping the same checklist item opens the same existing modal.
   - Confirm the modal still reaches the `Enter Your Name` step when requirements are met.