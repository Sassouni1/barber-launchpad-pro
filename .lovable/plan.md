

## Plan: Fix Aion's Overreaction to "Hey" + Consultation Terminology

**Two problems:**
1. When a user just says "hey", Aion dumps a full coaching plan instead of a casual greeting. The system prompt says "react to what they said" but doesn't explicitly tell Aion to keep it light for greetings.
2. Every mention of "Free Consultation" should be "Free Hair System Consultation" or "Free Hair Loss Consultation" — never just "Free Consultation."

### Changes

**File: `supabase/functions/member-help-chat/index.ts`**

1. **Add a greeting rule** (after "How to open" section, ~line 66-68): Add explicit instruction that when the user says something casual like "hey", "hi", "what's up" — Aion should respond casually back, maybe acknowledge recent progress briefly if any, and ask what they want to help with. Do NOT launch into a full action plan unprompted. Only give task-based coaching when they ask for it.

2. **Replace all "free consultation" references** throughout the `BASE_SYSTEM_PROMPT` with "free hair system consultation" — this applies to:
   - Line 45: "free consultation" → "free hair system consultation"
   - Line 94: "Free Consultation" → "Free Hair System Consultation"
   - Line 103: "Book Free Consultation" → "Book Free Hair System Consultation"
   - Line 108: "Free Consultation" → "Free Hair System Consultation"
   - Line 115: "FREE CONSULTATION" → "FREE HAIR SYSTEM CONSULTATION"
   - Line 114: coaching script should say "free hair system consultation" not just "consultation"

3. **Add a terminology rule** in OTHER GUIDELINES (~line 124): "Always say 'free hair system consultation' or 'free hair loss consultation' — NEVER just 'free consultation.' The specificity matters for client trust and SEO."

