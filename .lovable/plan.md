

## Soften Headline Tone and Prevent Repetition

### Problem
The AI is generating shame-based, negative headlines like "STOP HIDING" (repeated twice). This feels confrontational and could alienate potential clients rather than attract them.

### Solution
Add two prompt rules in `supabase/functions/generate-marketing-image/index.ts`:

1. **Tone guidance**: Add instruction that headlines should be positive, aspirational, and empowering -- never shame-based or negative. Examples: "Look Your Best", "Confidence Starts Here", "Your Best Look Awaits" vs. "Stop Hiding", "Don't Be Afraid".

2. **No repetition**: Add rule that no word or phrase should appear more than once on the image.

### Technical Change

**`supabase/functions/generate-marketing-image/index.ts`** -- Add two new design rules to the prompt:

- Rule: "Headlines must be POSITIVE and ASPIRATIONAL. Focus on the transformation and confidence gained, never on shame, fear, or what the client is currently lacking. Use empowering language like 'Your Best Look', 'Confidence Redefined', 'Transform Your Look' -- never 'Stop Hiding', 'Don't Be Afraid', or similar negative phrasing."
- Rule: "Never repeat the same word or phrase more than once anywhere on the image."

