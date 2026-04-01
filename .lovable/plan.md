

## Plan: Update Aion Greeting Bullets

**File: `src/components/dashboard/AionChat.tsx`** — two identical greeting strings (lines 112 and 127)

Replace the current 5 bullets with these 6, ordered by immediacy and ease:

```
• **"Talk to people in my chair"** — every client is a referral source, just ask if they know anyone
• **"Post a quick story"** — not polished, just announce you offer hair systems
• **"DM 20 people"** — message people on Facebook/Instagram, no sales pitch, just let them know
• **"Message past clients"** — reconnect and let them know what you're offering now
• **"Set up a referral program"** — reward clients who send people your way
• **"How do I run Facebook ads?"** — most effective long-term, I'll walk you through it
```

Keep intro ("Hey! 👋 I'm **Aion**...") and closing ("Think of me like a coach in your pocket...") unchanged. Keep the existing "What should I work on next?" bullet as bullet #1 since it's tied to checklist progress, making 7 total.

Also update the system prompt in **`supabase/functions/member-help-chat/index.ts`** to reinforce: once any conversation starts with a potential client, always guide toward inviting them for a free consultation.

