

## Plan: Rewrite Aion's Response Format to Feel Like a Real Coach

### The Problem with the Current Approach
We've been making Aion *more rigid* with each iteration — forced `###` headings, mandatory `---` separators, hard word caps, `**Coach check-in:**` labels. That's the opposite of what the reference AI does well.

The reference AI feels like a smart person talking to you. Aion feels like a template filling itself in.

### What the Reference AI Actually Does (That We Should Steal)

1. **Opens by reacting to the person** — "You're not crazy for feeling this way" / "Good. Then stop arguing..." — it earns the right to give advice by showing it heard you first
2. **Uses `**bold text**` for section titles, not `###` headings** — lighter, less "documentation-y"
3. **Mixes formats freely** — sometimes numbered bold sections, sometimes just paragraphs, sometimes bullets inside sections. It matches the format to the content, not a template
4. **Gives copy-paste scripts** — actual words to say to clients, put in bios, post on social media
5. **Varies length by question depth** — simple question = short answer; complex/emotional question = detailed breakdown
6. **Ends naturally** — just asks a direct question or gives a challenge, no label like "Coach check-in:"
7. **Uses "you" language and strong opinions** — "Your constraint is volume, not talent" vs generic advice

### Changes

**File: `supabase/functions/member-help-chat/index.ts` — rewrite the RESPONSE FORMAT section**

Replace the current rigid template rules with:

- **Open conversationally** — React to what they said in 1-2 sentences before giving any structure. Reframe their problem or validate it.
- **Use `**bold numbered titles**` for action items** — not `###` markdown headings. Lighter visual weight, feels more like texting.
- **Mix paragraphs and structure naturally** — Don't force everything into numbered lists. Use short paragraphs (1-3 sentences) between structured parts.
- **Remove the hard 150-200 word cap** — Replace with "match your depth to their question. Simple = short. Complex = detailed."
- **Keep max 3 action items** for action-based advice (this rule works)
- **Remove the `---` separator and `**Coach check-in:**` label** — Instead, just end with a natural question or challenge on its own line
- **Include copy-paste scripts when relevant** — If telling them to update their bio, give them the exact text. If telling them to talk to clients, give them the exact words.
- **Update BAD/GOOD examples** to reflect the new natural style

Example of the new "GOOD" format to embed:

```
You're overthinking this. The fastest way to get a client this week isn't a perfect Instagram page — it's opening your mouth.

**1. Tell every person in your chair today**
"Hey, I'm now doing hair replacement systems for men. Know anyone dealing with thinning?" That's it. Say it to every single client today.

**2. Update your bio right now ⚡**
Add "Hair System Specialist" and a "Book Free Consultation" link. If it's not in your bio, you don't officially offer it.

**3. DM 10 people on Facebook tonight**
Not a sales pitch. Just: "Hey, wanted to let you know I'm now offering hair systems for men dealing with hair loss. Know anyone who might be interested?"

Have you set up a "Free Consultation" option in your booking app yet? That's the thing that turns all this activity into actual booked clients.
```

### Files to Edit
- `supabase/functions/member-help-chat/index.ts` — `BASE_SYSTEM_PROMPT` only (the RESPONSE FORMAT section)

