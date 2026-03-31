

# Tabs Inside the Contact Card: Aion + Contact a Person

## Why Tabs Work Best

Tabs inside a single card keep it tight — one footprint on the dashboard, no layout bloat. The user picks their path:

- **"Ask Aion"** — instant AI chat for quick questions
- **"Contact a Person"** — the existing feedback form

No side-by-side columns, no extra cards, no clutter. One glass-card, two tabs.

```text
┌─────────────────────────────────────────┐
│  How Can We Help?                       │
│                                         │
│  ┌──────────┬───────────────────┐       │
│  │ Ask Aion │ Contact a Person  │       │
│  └──────────┴───────────────────┘       │
│                                         │
│  (active tab content here)              │
│                                         │
└─────────────────────────────────────────┘
```

## What Gets Built

### 1. Edge Function: `supabase/functions/member-help-chat/index.ts`
- Lovable AI gateway with `google/gemini-3-flash-preview`
- System prompt grounded in platform context (hair system training, courses, certification, group calls, rewards)
- Streams response via SSE
- Handles 429/402 errors

### 2. New Component: `src/components/dashboard/AionChat.tsx`
- Compact chat UI: scrollable message area + input bar
- Streaming token-by-token rendering
- Markdown rendering via `react-markdown`
- Conversation is local state only (no DB persistence)
- Matches existing gold/glass design system

### 3. Edit: `src/components/dashboard/ContactSection.tsx`
- Wrap everything in a `<Tabs>` component with two triggers: "Ask Aion" and "Contact a Person"
- "Ask Aion" tab renders `<AionChat />`
- "Contact a Person" tab renders the existing form (no changes to form logic)
- Card title stays "How Can We Help?" above the tabs
- Default tab: "Ask Aion"

### 4. Dashboard (`src/pages/Dashboard.tsx`)
- No changes needed — `<ContactSection />` is already rendered

## Why It Won't Be Convoluted
- Single card, single location on dashboard — no new page or sidebar item
- Tabs clearly separate the two modes
- AI chat is self-contained (own component, own state)
- Form logic stays untouched
- No database changes needed

