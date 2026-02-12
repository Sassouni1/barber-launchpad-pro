

## AI Marketing Content Generator

Build a Pomelli-like feature where members paste their business website URL and get AI-generated marketing content (social media posts, ads, captions) tailored to their brand.

### How It Works

1. Member pastes their website URL
2. The system scrapes the website to extract brand identity (colors, tone, services, unique selling points)
3. AI generates on-brand marketing content: Instagram captions, Facebook posts, ad copy, and more
4. Member can copy/download the content and regenerate as needed

### What Gets Built

**New Page: `/marketing`**
- Clean form with a URL input field
- Content type selector (Instagram post, Facebook ad, Google ad, general social post)
- Tone selector (professional, casual, luxury, bold)
- Generated content displayed in copyable cards
- "Regenerate" button for new variations
- Loading states with the existing gold/cyber design system

**Navigation Updates**
- Added under "Barber Launch Calls" section in the sidebar as a new expandable group or standalone item
- Added to mobile nav

**Backend: 2 Edge Functions**
- `scrape-website` -- Uses Firecrawl to extract brand info (colors, services, tone, key messaging) from the member's URL
- `generate-marketing` -- Uses Lovable AI (Gemini Flash) to generate marketing content based on the scraped brand data and selected content type

**Connector Required**
- Firecrawl connector will be connected for website scraping capabilities

### Technical Details

**Files to create:**
- `src/pages/Marketing.tsx` -- Main page component with URL input, content type/tone selectors, results display
- `supabase/functions/scrape-website/index.ts` -- Firecrawl integration to extract brand identity from a URL
- `supabase/functions/generate-marketing/index.ts` -- Lovable AI integration to generate marketing copy

**Files to modify:**
- `src/App.tsx` -- Add `/marketing` route
- `src/components/layout/Sidebar.tsx` -- Add Marketing nav item
- `src/components/layout/MobileNav.tsx` -- Add Marketing nav item
- `supabase/config.toml` -- Register new edge functions with `verify_jwt = false`

**Edge function flow:**

```text
User enters URL
    |
    v
scrape-website (Firecrawl)
    - Scrapes URL with formats: ['markdown', 'branding']
    - Extracts: brand colors, services offered, tone, key phrases
    - Returns structured brand profile
    |
    v
generate-marketing (Lovable AI - gemini-3-flash-preview)
    - Receives brand profile + content type + tone preference
    - System prompt crafted for hair system / barber business marketing
    - Returns 3 content variations per request
    |
    v
Display in copyable cards with regenerate option
```

**UI matches existing design:** dark cyber-gold theme, glass cards, gold accents, same Card/Button/Input components used throughout the app.

