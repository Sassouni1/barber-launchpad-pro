

## Plan: Light Theme for Find a Specialist Site

The public directory at `find.menshairexpert.com` will use a clean **white/light theme** instead of the dark cyber-gold look. The member app at `member.thebarberlaunch.com` stays dark — only the public directory changes.

### Approach

1. **Add a `.light-theme` CSS class** in `src/index.css` that overrides the core HSL variables (`--background`, `--foreground`, `--card`, `--border`, `--muted`, etc.) with light values:
   - Background: white
   - Text: near-black
   - Cards: white with soft shadows (no glass/glow effects)
   - Accent: refined gold for CTAs

2. **Apply the class conditionally** in `App.tsx` based on hostname:
   - `find.menshairexpert.com` → add `light-theme` to `<html>`, remove `dark`
   - All other domains → keep current dark theme untouched

3. **Directory pages styled for light theme**:
   - `/find-a-pro` search page: white background, clean cards, gold accent buttons
   - Result cards: white with soft shadow, photo on top, name/city below
   - Skip `cyber-grid`, `glass-card`, `gold-glow`, `spotlight-pulse` on directory routes

### Pick the vibe before I build

**Light style options:**
- **A. Clean white + gold accents** — pure white bg, black text, gold buttons. Premium and minimal.
- **B. Warm off-white + gold** — cream background, charcoal text, gold accents. Editorial luxury feel.
- **C. White + black only** — no gold at all. Modern Apple-style minimalism.

**Accent color:**
- Same bright gold as member app (consistent brand)
- Darker/richer gold (reads better on white — bright gold can wash out)
- Different color entirely (tell me which)

Reply with your picks and I'll build the directory + light theme together.

