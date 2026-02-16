

## Fix: Before-and-After = Two People, Both Heads Must Be Fully Visible

### The Problem

Before-and-after reference photos show two views of the same person side by side -- effectively two people in one image. The current rules say "show both sides" but the AI still crops one person's head because it doesn't treat the before-and-after as "two separate people who each need full head visibility."

### The Fix

**File: `supabase/functions/generate-marketing-image/index.ts`**

#### 1. Rewrite RULE #3 (Before-and-After) to explicitly say "two people"

Replace the current Rule #3 text with:

> "BEFORE-AND-AFTER PHOTOS: If the reference photo contains a before-and-after comparison, it shows TWO PEOPLE (or two views of the same person). BOTH people's ENTIRE heads, ALL hair, and COMPLETE faces must be fully visible with breathing room on all sides. Rule #1 (Full Head Visibility) applies to EACH person individually. Scale the entire photo DOWN until BOTH people fit completely within the frame with NO cropping on ANY edge. It is better to have the photo appear smaller with generous padding than to crop any part of either person's head or hair. Showing only one side or cropping the top of either person's head is an IMMEDIATE FAILURE."

#### 2. Update Rule #9 (Person Framing) to reinforce "every person"

Add to Rule #9: "In before-and-after photos, this applies to BOTH the 'before' person and the 'after' person independently -- both heads must have full visibility."

#### 3. Update Verification Step #4

Replace current step 4 with: "Does the reference photo show a before-and-after transformation (two people/views)? If YES, check EACH person's head separately -- can you see the COMPLETE hair, forehead, and face of BOTH people with space around them? If either person's head is cropped at any edge, scale the entire photo smaller and redo."

#### 4. Add sizing constraint to layouts

In each of the 3 layout descriptions that mention before-and-after, add: "If the photo contains two people (before-and-after), scale it so that BOTH heads occupy no more than 70% of the available panel height, leaving at least 15% padding above the tallest head."

### What stays the same
- All other rules, layouts, headline pools, retry logic, gold accents
- Reference image fetching and base64 encoding
- The overall prompt structure (critical rules first, then layout, then design rules)
