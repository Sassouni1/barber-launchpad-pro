

## Diversify Headlines and Content Themes

### Problem
The AI keeps generating the same "confidence" and "hair loss is hard" messaging because:
1. The **text generator** prompt for hair-system category literally lists "Get your confidence back" as a suggested phrase and focuses heavily on emotional/confidence themes
2. The **image generator** derives its headline from that caption text, so the same "reclaim your confidence" angle carries through to every image

### Solution
Update both edge functions with broader, more varied creative direction.

### Changes

**1. `supabase/functions/generate-marketing/index.ts` -- Diversify caption themes**

Replace the hair-system category phrases with a wider set of angles:
- Results-focused: "Fresh install. Fresh look.", "See the difference for yourself"
- Service-focused: "Same-day installs available", "Custom color-matched units"  
- Social proof: "Join 500+ clients who made the switch", "Our most requested service"
- Lifestyle: "Look good. Feel good.", "Ready for your new look?"
- Urgency: "Limited spots this week", "Now booking for [month]"

Also add a rule in the system prompt: "Each of the 3 variations MUST use a different angle -- one results/transformation-focused, one service/offer-focused, and one lifestyle/aspirational. Do NOT make all three about confidence or emotional recovery."

**2. `supabase/functions/generate-marketing-image/index.ts` -- Broaden headline variety**

Add explicit headline direction in the prompt:
- Provide a list of headline **styles** the AI should rotate between: results-driven ("Fresh Look. Zero Surgery."), service-driven ("Same-Day Installs"), lifestyle ("Look Good Every Day"), urgency ("Book This Week"), social proof ("Trusted By Hundreds")
- Add rule: "Do NOT use the words 'confidence', 'reclaim', 'journey', or 'hair loss' in the headline. Focus on the positive outcome, the service, or a call to action instead."
- This keeps headlines punchy and varied rather than always defaulting to the emotional angle

### Why This Works
The root cause is that the prompts over-index on one emotional angle. By explicitly requiring variety and banning overused words, we force the AI into fresher, more marketing-savvy territory -- the kind of content real barbershops actually post.
