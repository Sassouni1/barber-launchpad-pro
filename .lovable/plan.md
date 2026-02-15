

## Fix: Force Gemini to ALWAYS Use the Provided Reference Photo

### The Problem
When a reference photo is attached (Brand Images mode), Gemini sometimes ignores it entirely and generates a synthetic/AI person instead of compositing the actual photo you gave it. The current instructions say "You MUST use this photo" but that's clearly not aggressive enough.

### The Fix

**File: `supabase/functions/generate-marketing-image/index.ts`**

**1. Rewrite the `REFERENCE PHOTO INSTRUCTIONS` block (lines 131-140) to be extremely aggressive:**

Replace the current polite instructions with something like:

```
=== ABSOLUTE NON-NEGOTIABLE RULE — REFERENCE PHOTO ===
A reference photo has been provided as an input image. You are FORBIDDEN from generating, creating, drawing, or synthesizing ANY person, face, hair, or human subject.

DO NOT generate a new person. DO NOT create an AI face. DO NOT illustrate a human. The ONLY human imagery allowed in your output is the EXACT reference photo provided.

You must:
- EMBED the provided reference photo directly into your composition as the hero image
- Use the EXACT pixels — do not redraw, repaint, re-imagine, or "improve" the person
- You MAY crop, resize, apply color grading, lighting filters, or tonal shifts
- Place text and design elements AROUND or BESIDE the photo, never over faces
- The final result must look like a designed social media post featuring the REAL photo

If you cannot use the reference photo for any reason, output a design with NO PEOPLE AT ALL — use abstract textures, barbershop tools, or geometric patterns instead. NEVER substitute with an AI-generated person.

=== SELF-CHECK BEFORE FINALIZING ===
Look at your output. Does it contain a person that was NOT in the reference photo? If yes, you have FAILED. Remove that person and use ONLY the reference photo or no people at all.
```

**2. Add a final verification block at the very end of the prompt (after the CRITICAL DESIGN RULES section, ~line 200):**

```
=== FINAL VERIFICATION — DO THIS BEFORE OUTPUTTING ===
1. Does your image contain any human face or body? If YES, is it from the provided reference photo? If you generated a new person, DELETE THEM and redo with the reference photo only.
2. The reference photo is the ONLY source of human imagery allowed. No exceptions. No "inspired by" versions. The actual photo pixels.
```

### What stays the same
- All headline logic, layout selection, color/font extraction
- CTA rules, face protection rules, format rules
- The non-reference path (AI Generated mode) keeps its current photography instructions unchanged
- Everything outside the reference photo prompt sections

### File changed
- `supabase/functions/generate-marketing-image/index.ts`
