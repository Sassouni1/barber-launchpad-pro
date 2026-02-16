

## Fix Fake Image Generation + Restore Gold Styling

### Problems
1. **Fake AI-generated people**: Despite strong rules, 1 out of 3 images still sometimes has an AI-generated person instead of using the real reference photo
2. **Missing gold styling**: The thin gold frames, gold dotted dividers, and gold text accents from your reference images aren't showing up consistently

### Changes

**File: `supabase/functions/generate-marketing-image/index.ts`**

#### 1. Move anti-fake-person rule to the VERY TOP of the prompt (before layout, before colors, before everything)

Currently the reference photo instructions appear mid-prompt after layout and colors. The AI model processes instructions top-down, so by the time it reaches the "don't generate fake people" rules, it may have already started composing with a generated person. Moving it to the absolute first thing the model reads will make it the strongest constraint.

New prompt structure:
```
1. FIRST: Anti-fake-person absolute rule (if reference attached)
2. Then: Aspect ratio
3. Then: Colors
4. Then: Layout
5. Then: Text/headline
6. Then: Design rules
7. Then: Verification
```

#### 2. Add a "STOP AND CHECK" instruction right after the reference image inline data

Before the text prompt even begins, add a preamble that says: "The image above is a REAL photograph. Your ONLY job is to place this EXACT photo into a designed marketing layout. You are NOT creating a person — you are designing AROUND this photo."

#### 3. Strengthen gold accent instructions in the layout descriptions

Each layout already mentions gold, but the instructions are buried. Add explicit gold requirements to the design rules section:

- Add Rule 16: "GOLD ACCENTS: Every image MUST include at least one visible gold (#D4AF37) design element — a thin gold outer border/frame, a gold dotted-line divider, gold text on key headline words, or a gold CTA button outline. Gold is the signature accent of this brand's visual identity."

This makes gold a rule-level requirement rather than just a suggestion in the layout text.

#### 4. Add negative example to anti-fake rule

Add: "COMMON FAILURE MODE: The AI often generates a 'similar looking' person with slightly different features, different lighting, or a cleaner background. This is STILL a fake person. The ONLY acceptable human imagery is the literal pixel data from the reference photo, with optional color grading applied."

### What stays the same
- All existing rules 1-15
- Verification steps 1-7
- Headline pools, retry logic, color palette logic
- Layout variety (3 distinct styles)

