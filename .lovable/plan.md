

## Add example photo to Directory Enrollment step

Add the uploaded reference image as a small example thumbnail inside the "Take a photo holding your certification" step on the Get Added to the Men's Hair Expert lesson, so members see exactly what their submission should look like.

### What will change

- Save the uploaded image into the project as a real asset:
  - `src/assets/directory-proof-example.png`
- Update `src/components/lesson/DirectoryEnrollmentLesson.tsx` (`ProofStep`) to:
  - Import the new asset.
  - Render it as a small thumbnail (around 96–128px) below the step instructions, only when the user has NOT yet uploaded their proof photo (so it acts as guidance, not clutter).
  - Add a small caption underneath: "Example — take a photo like this".
  - Keep the dark/metallic-gold luxury aesthetic (rounded border, subtle gold ring, no heavy filters per mobile performance rules).

### Layout

```text
[Award icon]  Take a photo holding your certification
              1. Print your certificate...
              2. Hold it up next to your face...
              3. Snap a clear, well-lit photo...

              ┌──────────┐
              │  example │   Example — take a
              │  photo   │   photo like this
              └──────────┘

[ Upload picture holding certification ]
```

### Files touched

- `src/assets/directory-proof-example.png` (new — copied from upload)
- `src/components/lesson/DirectoryEnrollmentLesson.tsx` (small JSX addition in `ProofStep`)

No DB, edge function, or routing changes.

