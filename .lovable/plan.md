# Fix: Certificate name drifts right of `name_x`

## Root cause
`generate-certificate` sets `ctx.textAlign = 'center'`, but the Deno `canvas@v1.4.2` library doesn't honor it correctly with the loaded custom/script font — text is drawn left-anchored at `name_x` instead of centered on it. Pixel measurements of real certs confirm every name's leftmost pixel sits at exactly x=1390 regardless of length (Adriana drifts 334px right of true center, Lexi drifts 238px). The admin editor uses HTML/CSS with `transform: translate(-50%, -50%)` so its preview looks correct — the two renderers disagree.

## Fix
Update `supabase/functions/generate-certificate/index.ts` only. No DB, no admin UI, no client changes.

1. Set `ctx.textAlign = 'left'` for the name.
2. Measure the final (post auto-shrink) text width with `ctx.measureText(certificateName).width`.
3. Draw at `nameX - textWidth / 2` so the visual center sits exactly on `name_x` — matching what the admin preview shows.
4. Keep the existing auto-shrink loop and `name_max_width` behavior; measure width after the loop settles.
5. Leave the date rendering alone (already `textAlign='left'`, already correct).
6. Debug-mode green vertical line at `nameX` stays — it now correctly bisects the name.

## Verification
1. Regenerate Adriana's and Lexi's certs via the existing "Regenerate With Name" flow.
2. Fetch the resulting PNGs and confirm the visual center of the name equals ~1400 (±5px) for both — matching template center regardless of name length.
3. Spot-check a long name ("Christina Snowball Johnson") and a short name ("Lexi Zoller") — both should sit centered.
4. Confirm admin preview and generated output now look identical.

## Out of scope
- Talaundra's stored PNG (rendered under a prior layout) won't retroactively change; regenerate if desired.
- No changes to `certificate_layouts` values — `name_x = 1390` stays.
