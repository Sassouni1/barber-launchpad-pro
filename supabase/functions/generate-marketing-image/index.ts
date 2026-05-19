const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch reference image: ${resp.status}`);
  const contentType = resp.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await resp.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  // Manual base64 encoding in chunks to avoid stack overflow
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const chunk = uint8.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  return { base64, mimeType: contentType.split(';')[0] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandProfile, variationTitle, variationContent, contentType, tone, index, palette, size, referenceImageUrl, ethnicity } = await req.json();

    if (!brandProfile || !variationContent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brand profile and variation content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_KEY');
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Google AI Studio key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const layoutIndex = typeof index === 'number' ? index % 3 : 0;
    const isStory = size === 'story';
    const useGold = palette !== 'website';

    const colors = brandProfile.branding?.colors || {};
    const fonts = brandProfile.branding?.fonts || [];

    let primaryColor: string, secondaryColor: string, bgColor: string, textColor: string, accentColor: string;

    if (useGold) {
      primaryColor = 'METALLIC GOLD GRADIENT (deep burnished bronze #8B6914 → rich gold #D4AF37 → bright luminous gold #F0D060)';
      secondaryColor = 'METALLIC GOLD GRADIENT (same as primary)';
      bgColor = '#0A0A0A (TRUE BLACK)';
      textColor = '#FFFFFF';
      accentColor = 'METALLIC GOLD GRADIENT (same as primary)';
    } else {
      primaryColor = colors.primary || colors.textPrimary || '#FFFFFF';
      secondaryColor = colors.secondary || colors.accent || '#D4AF37';
      bgColor = colors.background || '#1A1A1A';
      textColor = colors.textPrimary || '#FFFFFF';
      accentColor = colors.accent || colors.secondary || '#D4AF37';
    }

    const fontFamily = fonts.length > 0 ? fonts.map((f: any) => f.family).join(', ') : 'bold sans-serif';

    const brandColorBlock = useGold ? `
BRAND COLORS — METALLIC GOLD + TRUE BLACK PALETTE:
- Gold elements: METALLIC GOLD GRADIENT — transitions from deep burnished bronze (#8B6914) at edges/shadows, through rich gold (#D4AF37) in midtones, to bright luminous gold (#F0D060) at highlights. This creates a 3D metallic shimmer effect like polished gold foil or a luxury embossed business card. Every gold element (text, borders, CTA bars, dividers) MUST use this gradient treatment — never flat single-tone gold.
- Background: Dark and premium — deep black (#0D0D0D), rich charcoal (#1A1A1A), or other dark moody tones. The background should feel luxurious and cinematic. Avoid bright, light, or medium-toned backgrounds.
- Text: Alternate between WHITE (#FFFFFF) and METALLIC GOLD for visual punch.

Brand fonts: ${fontFamily}
` : `
BRAND COLORS (use these EXACT hex values throughout the design):
- Primary: ${primaryColor}
- Secondary/Accent: ${secondaryColor}
- Background base: ${bgColor}
- Text color: ${textColor}
- Accent highlight: ${accentColor}

Brand fonts: ${fontFamily}
`;

    const aspectInstruction = isStory
      ? `The output MUST be a 9:16 vertical portrait image (1080x1920 pixels). Tall and narrow like an Instagram Story or TikTok.

CRITICAL INSTAGRAM STORY SAFE ZONES — these are NON-NEGOTIABLE:
- TOP 15% of the canvas must be EMPTY padding (just the dark background, no text, no logos, no headlines, no photo content) — this is reserved for the Instagram profile/username UI overlay.
- BOTTOM 20% of the canvas must be EMPTY padding (just the dark background, no text, no CTAs, no photo content) — this is reserved for the Instagram reply/typing bar and "Send message" UI.
- ALL design content (headlines, photo, stickers, CTA, captions) MUST live inside the MIDDLE 65% of the canvas (between the 15% top safe-zone and the 20% bottom safe-zone).
- Compose every element inside this middle band. The top and bottom safe zones extend the existing dark background only — same color, no decoration, no edge accents, no fades.`
      : 'The output MUST be a 1:1 square image (1080x1080 pixels).';

    const hasReference = !!referenceImageUrl;

    const hasBrandName = !!brandProfile.title;

    const layouts = [
      // LAYOUT A — "ATTENTION CITY MEN" stat-callout flyer (matches Danville reference)
      `Vertical-stack flyer layout on deep matte black (#0A0A0A) with subtle gold geometric line accents (thin diamonds, corner brackets) ghosted in the background corners.
TOP THIRD — HEADER:
  - Tiny gold "— ATTENTION —" eyebrow tag with thin gold rules on either side, centered
  - MASSIVE bold white display headline directly under it, taking the full width (e.g. a city/audience name in chunky condensed sans, all caps), with one or two key words rendered in metallic gold gradient
  - Thin gold horizontal rule with a small gold diamond marker in the middle
MIDDLE THIRD — 3 ICON STAT ROWS:
  - Three stacked rows. Each row = (left) a perfectly circular gold-outlined icon badge (~80px) containing a SIMPLE flat gold line icon (people silhouettes, baseball cap, calendar with checkmark, hair follicle, stopwatch, shield-check), (right) a 2-line bold uppercase statement where the FIRST 1-2 words are gold and the rest is white. Thin gold horizontal divider between rows.
BOTTOM THIRD — IMAGERY + CTA:
  ${hasReference ? 'Reference photo placed full-width here with no modifications, both heads (if before/after) fully visible with breathing room.' : 'Before/After split of the SAME man side-by-side, both heads fully visible.'}
  - Thin row of 3 small feature badges directly under the image: small gold icon + short uppercase label (e.g. "FULL HAIR.", "NATURAL.", "NON SURGICAL."), separated by thin vertical gold rules
  - Bottom CTA: a wide pill-shaped METALLIC GOLD GRADIENT button (bronze→gold→bright-gold shimmer) with a small calendar icon on the left, bold black uppercase text in the middle ("BOOK YOUR FREE HAIR SYSTEM CONSULT"), and a chevron ">" on the right.
This is a richly designed promotional flyer — busy, layered, premium. NOT minimalist.`,

      // LAYOUT B — "GUARANTEED RESULTS" brushstroke poster (matches the brushstroke reference)
      `Cinematic dark poster layout on near-black textured background (#0A0A0A with subtle grunge/grain texture).
TOP — TITLE BLOCK (40% of canvas):
  - Tiny gold "— SAME DAY —" eyebrow tag with thin gold side rules, centered
  - Massive distressed/textured WHITE word in heavy condensed display font ("GUARANTEED" or similar power word), with subtle grain/scratch texture overlay
  - Below it, a HUGE handwritten brushstroke-style word in METALLIC GOLD GRADIENT script ("RESULTS" or similar) — looks hand-painted with a thick paint brush, rough edges, paint spatter, slight tilt
  - A short rough gold brushstroke underline
MIDDLE — BEFORE/AFTER (45% of canvas):
  ${hasReference ? 'Reference photo as the centerpiece, placed without modifications, both heads fully visible with breathing room.' : 'Before/After split of the SAME man side-by-side. The before side may be desaturated to monochrome for contrast; the after side is full color with the warm golden rim light. Both heads fully visible.'}
  - "BEFORE" label top-left of the before side and "AFTER" label top-right of the after side — both rendered in white handwritten brushstroke style with a small gold brush underline
  - A diagonal gold brushstroke or thin gold light-streak divides the two sides through the middle
  - Rough painted black brush-frame edges around the photo (torn-edge effect)
BOTTOM (15% of canvas):
  - Three small feature callouts in a row: each = a circular gold brushstroke ring containing a small gold icon (stopwatch, hair-follicle, calendar-check), with a brushstroke-script gold word underneath ("SAME DAY", "NATURAL", "FREE") and a small white uppercase subtitle ("TRANSFORMATION", "LOOK & FEEL", "CONSULTATION")
  - Bottom CTA: a rough gold brushstroke banner with bold black uppercase text ("SCHEDULE YOUR FREE CONSULTATION >") — looks hand-painted, not a clean rectangle.`,

      // LAYOUT C — "ENGINEERED HAIRLINES" minimal editorial card (no border)
      `Sophisticated minimal editorial layout on pure black (#000000). NO border, NO frame, NO double-rule outline around the canvas — the design must breathe edge-to-edge with generous internal margins instead.
TOP (25%):
  - Top-left aligned: bold uppercase display headline broken across 2 lines, alternating white and metallic-gold-gradient words (e.g. "ENGINEERED HAIRLINES." in white + "BARBER-FINISHED." with key words in gold). Tight letter spacing, heavy weight. Comfortable margin from the canvas edge (~6%).
  - Tiny gold "—" rule under the headline (just a short horizontal line, not a full-width frame).
MIDDLE (60%):
  ${hasReference ? 'Reference photo placed centered with no modifications, both heads fully visible with breathing room. No frame around the photo — let it sit on the black background cleanly. If before/after, the photo already contains both sides — do not add a divider.' : 'Two equal portrait panels side-by-side: LEFT = BEFORE (same man, mild thinning/recession), RIGHT = AFTER (same man, full restored hair). A single thin vertical gold hairline between them — that is the ONLY gold line allowed. Small white "BEFORE" label bottom-left of the left panel and "AFTER" bottom-right of the right panel.'}
BOTTOM (15%):
  - Centered metallic gold gradient pill CTA button ("BOOK A FREE CONSULTATION") with bold black uppercase text inside.
  - Below the CTA, three small gold dot pagination markers (one larger gold pill in the middle).
Sophisticated, calm, premium — the layout breathes. White space and typography do the work. ABSOLUTELY NO border, frame, double-rule, or outlined card around the canvas edges.`,

    ];

    const layoutInstruction = layouts[layoutIndex];

    // Index-based headline rotation: each image gets a different subset
    const allHeadlines = [
      '"REAL HAIRLINE. REAL CONFIDENCE. ZERO SURGERY."',
      '"THINNING TO THICK. IN ONE SESSION."',
      '"SEAMLESS. CUSTOM. PRECISE."',
      '"ZERO PATCHY. ZERO OBVIOUS. ZERO COMPROMISE."',
      '"A HAIRLINE THAT HOLDS UP UNDER LIGHT."',
      '"BUILT TO BLEND. DESIGNED TO LAST."',
      '"NO SCARS. NO DOWNTIME. JUST RESULTS."',
      '"WHEN IT LOOKS THIS NATURAL, NO ONE ASKS."',
      '"ENGINEERED HAIRLINES. BARBER-FINISHED."',
      '"FROM RECEDING TO REDEFINED."',
      '"CLEAN HAIRCUT. FLAWLESS BLEND."',
      '"PRECISION INSTALLED. PROFESSIONALLY STYLED."',
      '"THE DIFFERENCE IS IN THE DETAILS."',
      '"PRECISION HAIR SYSTEMS INSTALLED DAILY"',
      '"INSTANT RESULTS. SEAMLESS BLEND. ZERO SURGERY."',
      '"FLAWLESS HAIRLINE, ZERO DETECTION."',
      '"INSTANT TRANSFORMATION. ZERO COMPROMISE."',
      '"FRESH LOOK. ZERO SURGERY. SAME-DAY RESULTS."',
    ];

    // Split into 3 pools of 6 headlines each
    const poolSize = 6;
    const poolIndex = layoutIndex % 3;
    const headlinePool = allHeadlines.slice(poolIndex * poolSize, poolIndex * poolSize + poolSize);
    const headlineExamples = headlinePool.map(h => `- ${h}`).join('\n');

    // Strip the first line of variationContent (it's usually the headline the AI copies)
    const contentLines = (variationContent || '').split('\n');
    const strippedContent = contentLines.length > 1 ? contentLines.slice(1).join('\n').trim() : variationContent;

    // Initialize parts array and fetch reference image data (attached AFTER prompt text)
    const parts: any[] = [];
    let referenceImageData: any = null;

    if (hasReference) {
      try {
        if (referenceImageUrl.startsWith('data:')) {
          const match = referenceImageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            referenceImageData = { inlineData: { data: match[2], mimeType: match[1] } };
          }
        } else {
          const { base64, mimeType } = await fetchImageAsBase64(referenceImageUrl);
          referenceImageData = { inlineData: { data: base64, mimeType } };
        }
        console.log('Reference image fetched and attached successfully');
      } catch (fetchErr) {
        console.error('Failed to fetch reference image:', fetchErr);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch reference image. Please try again.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Story-specific reference photo instructions
    const storyReferenceBlock = (isStory && hasReference) ? `
=== Story format (9:16) — reference photo placement ===
The reference photo should be placed as a large element within the vertical frame — it should occupy at least 50-60% of the canvas height.
Never regenerate or redraw the person to fit the vertical layout. If the photo does not naturally fill the vertical space, add dark premium background padding above and below the photo.
It is perfectly acceptable for the layout to be: headline text at top (15-20%), reference photo in the middle (50-60%), and CTA/brand at the bottom (15-20%).
The photo is a fixed asset — adapt the layout around it, never reshape or regenerate the person.
=== end story format ===
` : '';

    const stopAndReadPreamble = hasReference
      ? `Important — read before proceeding:
You are about to receive a real photograph of a real person. This photo is a provided photo layer — you cannot modify, redraw, repaint, re-imagine, or regenerate the pixels of this person. 

Your task: Design a marketing layout around this provided photo. The photo is a fixed input — treat it like a sticker being placed onto your design. You are a graphic designer compositing a layout, not a photographer generating new imagery.

What "provided photo layer" means:
- The person's face, hair, skin, clothing, pose, lighting, and background in the photo are all fixed
- You may only: resize the photo, position it within the frame, and add dark padding around it
- You may not: change the person's appearance, generate a "similar" person, improve the photo, change the lighting on the person, or create any new human imagery
- If the person in your output does not match the reference photo exactly, you have failed

Common failure mode: The AI generates a "similar looking" person with slightly different features, cleaner background, or better lighting. This is still a fake person and is a failure. The reference photo should appear in the final image exactly as provided — same pixels, same lighting, same background.

Do not render any instructional words as visible text on the image. The only text on the image should be the headline, brand name, and call-to-action.

`
      : '';

    const criticalRulesBlock = `=== The 3 most critical rules ===

Rule #1 — Full head visibility:
The entire head, all hair, the complete face, and the full forehead of every person in the image must be 100% visible at all times — in single photos and in before-and-after photos. This applies to every edge of the image (top, bottom, left, right). If any part of any person's head, hair, or face is cut off, cropped, or touches any edge, the image is a failure. Scale the photo down until every person's full head fits with visible breathing room on all sides. There are zero exceptions to this rule. This overrides all layout, composition, and framing decisions.

Rule #2 — Zero AI-generated people:
${hasReference ? `A reference photo has been provided. You are absolutely forbidden from generating, drawing, painting, or synthesizing any human face, head, hair, or body. The reference photo is the only source of human imagery — place it into the composition without any modifications. If you cannot include the reference photo, use no people at all — show barbershop tools, textures, or abstract patterns instead. Never create a "similar looking" person.` : `Generate original cinematic photography. Any people must look natural and authentic — professional barbershop/salon scenes.`}

Rule #3 — Before-and-after photos:
If the reference photo contains a before-and-after comparison, it shows two people (or two views of the same person). Both people's entire heads, all hair, and complete faces must be fully visible with breathing room on all sides. Rule #1 (full head visibility) applies to each person individually. Scale the entire photo down until both people fit completely within the frame with no cropping on any edge.

=== end critical rules ===
`;

    // When reference is present, use simplified compositing prompt (no photography generation language)
    const referencePhotoBlock = hasReference ? `=== Reference photo — provided photo layer instructions ===
This photo is a provided photo layer. You are placing it into your design without any modifications.
- Place the provided photo into the layout using its original pixels exactly as they are
- The photo is a fixed asset — do not redraw, repaint, enhance, or regenerate any part of it
- Design the background, text, headlines, borders, and decorative elements around this provided photo
- You may resize and reposition the photo within the frame
- You may add dark padding, borders, or frames around the photo
- You may not alter the person's face, hair, skin, clothing, lighting, or background
- Place text and design elements around or beside the photo, never over faces
- The final result must look like a professionally designed social media post with the real photo composited in
=== end provided photo layer instructions ===` : `=== PHOTOGRAPHY INSTRUCTIONS — HYPER-REALISTIC EDITORIAL PORTRAITURE ===

CRITICAL AESTHETIC: This must look like a REAL PHOTOGRAPH shot by a professional editorial photographer (think Peter Hapak, Platon, Annie Leibovitz). NOT an AI-rendered, stylized, or "studio stock" image. NOT a barbershop scene with a barber posing. The viewer must believe a real camera captured a real human being.

SUBJECT — AFTER-RESULT LED, NOT BALD-ONLY:
- The image must clearly show the successful AFTER result: a real-looking man, mid-30s to mid-50s, with a natural full hair system installed and barber-blended.
- Preferred format: BEFORE-AND-AFTER of the SAME man side-by-side. Left side = mild-to-moderate thinning or receding hairline only. Right side = the true after result with a full, natural, dense-but-believable head of hair.
- If using a single portrait, it must be the AFTER result only: natural full hair, restored hairline, clean blend, not bald, not thinning, not shaved.
- The before side may show recession or thinning, but it must never be completely bald, shiny scalp, shaved bald, severe alopecia, or cartoon-level hair loss.
- The after side must never still look bald or sparse. It needs visible coverage across the front hairline, temples, top, and crown with individual strands and realistic density variation.
- Before and after must look like the same person: same facial structure, same beard/stubble, same skin tone, same wardrobe, same pose, same lighting. Do not make the after a different younger model.

LIGHTING — non-negotiable signature look:
- Deep black background (#000000 to #0A0A0A), cinematic and moody
- Strong WARM GOLDEN RIM LIGHT raking the edges of the face, hair, beard, and shoulders from behind/above. This is the brand's signature light. Color temperature ~2800-3200K, intensity strong enough to outline the silhouette in molten gold
- Soft fill light on the front of the face — subtle, not flat
- Sharp focus on the eyes and hairline
- Shallow depth of field, full-frame camera look (think 85mm f/1.4 or 50mm f/1.8)

TRUE AFTER RESULT CHECKLIST — mandatory:
- The AFTER person has a natural, complete hairline and visible styled hair across the full top of the head.
- Hairline is age-appropriate and slightly imperfect: soft recession at temples is okay, but no bald forehead-to-crown scalp on the after.
- Hair has individual strands, root direction, subtle cowlicks, density variation, and a barber-finished shape-up. It cannot look like painted fibers, a wig cap, a helmet, or a plastic toupee.
- The after result should look like a high-end non-surgical hair replacement / hair system installation photographed immediately after a professional cut-in.

REALISM CHECKLIST — every one of these is mandatory:
- Visible skin texture: pores, fine lines, natural blemishes, stubble shadows on the jaw
- Asymmetrical face — real human proportions, not AI-perfect symmetry
- Eyes have real moisture and a real catchlight; NOT glassy, dead, or doll-like
- Hair shows individual strands, root variation, and real density variance — NOT a painted-on helmet
- Skin tone has natural color variance (slight redness around the nose, ears, under-eye shadow)
- Wardrobe: simple plain black or charcoal t-shirt or henley, no logos, no chains
- NO props (no scissors, no clippers, no spray bottles, no capes, no barber tools)
- NO second person (no barber in frame)
- NO mirror, NO reflections, NO barbershop counter, NO bottles, NO chairs, NO interior

FORBIDDEN — these are the AI tells we are eliminating:
- Plastic, smoothed, airbrushed skin
- Cartoon-symmetrical faces or "instagram filter" perfection
- Glassy, soulless, or asymmetric eyes
- Floating/incoherent background objects (mirror reflections that don't match, gibberish bottles, malformed chairs)
- A "barber" character holding tools — REMOVE the second person entirely
- Steam, mist, sparks, or floating particles
- Hands holding scissors or any prop
- Painted, helmeted, or wig-like hair
- A bald or nearly bald AFTER result
- A fully bald, shiny, shaved, or severe-hair-loss man as the main final result
- Before-and-after images where both sides are bald, sparse, or nearly identical
- An after result with exposed crown scalp, bald temples, or no visible hairline restoration
- Any cartoon, illustration, 3D render, or stylized look
- Bright, light, daytime, or studio-white backgrounds

The final image must be indistinguishable from a high-end editorial photograph shot for GQ or Esquire — same real male subject, dark background, dramatic golden rim light, brutally honest skin detail, and a believable premium AFTER hair restoration result that is visibly not bald.
=== end photography instructions ===`;

    const ethnicityMap: Record<string, string> = {
      black: 'Black/African-American man. Skin tone MUST genuinely vary across generations (medium-brown, deep brown, very dark brown — never the same shade twice). Authentic Black facial features: broad nose, full lips. MUST be visibly Black — NOT white, NOT racially ambiguous. Face shape, age, build, and hairstyle MUST clearly differ from the other generations — never repeat the same man.',
      white: 'White man of European descent. Vary the look meaningfully across generations — rotate between Northern European (very fair skin, blond/light-brown hair, blue or green eyes), Mediterranean/Italian (light-olive skin, dark-brown or black hair, brown eyes), and Slavic/Eastern European (fair skin, ash-brown or dark-blond hair, grey/hazel eyes). Face shape, age, hair color, eye color, beard style, and build MUST clearly differ from the other generations — NEVER repeat the same man or the same face twice. MUST be visibly white European — NOT tanned, NOT racially ambiguous.',
      hispanic: 'Hispanic/Latino man (Mexican, Puerto Rican, Dominican, or Central/South American descent), warm olive-tan to light-brown skin, jet-black or dark-brown thick hair (wavy or straight), dark brown eyes, Latino facial features. MUST be visibly Hispanic/Latino — NOT white, NOT European, NOT racially ambiguous, NOT a tanned white man.',
      asian: 'East Asian man (Chinese/Korean/Japanese descent), straight jet-black hair, medium-fair skin with warm undertones, monolid or single-fold eyes, Asian facial features. MUST be visibly East Asian — NOT white, NOT mixed.',
      middle_eastern: 'Middle Eastern man (Arab/Persian/Levantine descent), olive to medium-tan skin, thick jet-black wavy hair, full dark beard, prominent nose, dark eyes. MUST be visibly Middle Eastern — NOT white European.',
      mixed: 'Visibly mixed-race man with warm medium-brown skin, ambiguous handsome features, textured wavy or curly dark hair. Vary the look across generations — sometimes lean more Black/Latino, sometimes more Asian/White mix — NEVER repeat the same face.',
    };
    const ethnicityDesc = ethnicityMap[ethnicity] ?? ethnicityMap.mixed;

    const ctaInstruction = `CTA: pick a clear call-to-action ("BOOK A FREE CONSULTATION", "DM TO SCHEDULE", "LINK IN BIO", or "CALL NOW") — render in gold or white as a button or underlined text near the bottom.`;
    const brandNameLine = brandProfile.title
      ? `Brand name: "${brandProfile.title}" — render small and refined.`
      : `Do NOT invent or display any brand name on the image.`;

    // Per-image face variation so the 3 generations don't share the same face
    const faceVariations = [
      'Age 32, square jawline, full well-groomed beard, thick eyebrows, medium-toned skin for his ethnicity, warm brown eyes, subtle smile.',
      'Age 27, leaner oval face, light stubble (3-day growth), sharper cheekbones, lighter skin for his ethnicity, deep-set eyes, calm closed-mouth expression.',
      'Age 38, broader face with slight crow\'s feet, clean-shaven or very short stubble, stronger brow, deeper/darker skin for his ethnicity, direct confident gaze.',
    ];
    const faceVariation = faceVariations[layoutIndex % 3];

    // AFTER hairstyle variation — different finished look for each generation, ethnicity-appropriate
    const blackHairstyles = [
      'AFTER hairstyle: 360 waves with a sharp tapered fade and crisp lined-up edge-up.',
      'AFTER hairstyle: short twists / two-strand twists on top with a low taper fade and clean line-up.',
      'AFTER hairstyle: curly sponge-twist coils on top with a mid drop fade.',
      'AFTER hairstyle: textured afro top with a high skin fade and razor-sharp line-up.',
    ];
    const hispanicHairstyles = [
      'AFTER hairstyle: slick-back with a mid fade and sharp line-up.',
      'AFTER hairstyle: textured fringe / messy crop with a low taper fade.',
      'AFTER hairstyle: high-volume pompadour with a skin fade.',
      'AFTER hairstyle: clean side-part comb-over with a mid fade.',
    ];
    const asianHairstyles = [
      'AFTER hairstyle: K-pop style two-block cut with longer top.',
      'AFTER hairstyle: textured fringe with a low taper fade.',
      'AFTER hairstyle: middle-part medium-length style.',
      'AFTER hairstyle: short crop with a mid fade and natural hairline.',
    ];
    const middleEasternHairstyles = [
      'AFTER hairstyle: slicked-back medium-length with a mid fade and beard-blend line-up.',
      'AFTER hairstyle: textured side-swept top with a low taper.',
      'AFTER hairstyle: short modern crop with a skin fade.',
      'AFTER hairstyle: medium pompadour with a mid fade and connected beard.',
    ];
    const genericHairstyles = [
      'AFTER hairstyle: modern textured crop with a low taper fade and natural hairline.',
      'AFTER hairstyle: medium-length swept-back style with a mid fade.',
      'AFTER hairstyle: short pompadour with skin fade on the sides.',
      'AFTER hairstyle: classic side-part with a clean low taper.',
    ];
    const hairstylePool =
      ethnicity === 'black' || ethnicity === 'mixed' ? blackHairstyles
      : ethnicity === 'hispanic' ? hispanicHairstyles
      : ethnicity === 'asian' ? asianHairstyles
      : ethnicity === 'middle_eastern' ? middleEasternHairstyles
      : genericHairstyles;
    const hairstyleVariation = hairstylePool[layoutIndex % 3];

    // Scene variation: index 0 = natural barber-chair, indices 1-2 = cinematic dark editorial
    const isChairScene = layoutIndex % 3 === 0;

    const subjectBlock = isChairScene
      ? `SUBJECT (must match exactly, no exceptions):
One man only, seated naturally in a real leather barber chair, wearing a black or charcoal barber cape draped over his shoulders. ${ethnicityDesc}. ${faceVariation} ${hairstyleVariation} The BEFORE side shows the same man with thinning/receding hair or a bald crown — the AFTER side shows the hairstyle described above, fully restored, barber-finished. Relaxed posture, looking slightly off-camera or directly at camera. Skin tone, facial structure, and hair texture must authentically represent the specified ethnicity AND clearly differ from previous generations.`
      : `SUBJECT (must match exactly, no exceptions):
One man only. ${ethnicityDesc}. ${faceVariation} ${hairstyleVariation} The BEFORE side shows the same man with thinning/receding hair or a bald crown — the AFTER side shows the hairstyle described above, fully restored, barber-finished. Confident, relaxed expression. Fitted dark shirt, no logos. Skin tone, facial structure, and hair texture must authentically represent the specified ethnicity AND clearly differ from previous generations.`;

    const shotBlock = isChairScene
      ? `SHOT:
85mm lens, f/2.0. The subject is in a barber chair with a barber cape — show the cape clearly across his shoulders/chest. Background is INTENTIONALLY MINIMAL: deeply blurred, dark and out-of-focus so you can only sense it's a barbershop (suggested warm tungsten bokeh, hint of a mirror frame edge). DO NOT render a literal full barbershop scene — no visible bottles, scissors, clippers, station counters, posters, or other people. Warm golden rim light (~2800–3200K) from camera-right wrapping the silhouette. Soft front-left key. Cinematic falloff. Hyper-real skin texture: visible pores, micro-asymmetry, stubble shadows, single eye catchlight, individual hair strands. Vogue Hommes / GQ grade. Very shallow depth of field so the chair and cape stay sharp but the room dissolves.`
      : `SHOT:
85mm lens, f/2.0, deep matte black background (#0A0A0A). Warm golden rim light (~2800–3200K) from camera-right wrapping the silhouette. Soft front-left key. Cinematic falloff. Hyper-real skin texture: visible pores, micro-asymmetry, stubble shadows, single eye catchlight, individual hair strands. Vogue Hommes / GQ grade. Shallow depth of field.`;

    const forbiddenBlock = isChairScene
      ? `ABSOLUTELY FORBIDDEN:
- A second person in frame (no barber, no client, no hands reaching in)
- Visible barbershop props: scissors, clippers, spray bottles, combs, capes on hooks, station counters, product shelves, posters, signage
- A literal sharp-focus barbershop interior — the room must remain a soft blurred suggestion only
- Plastic / airbrushed / waxy skin, cartoon-symmetric faces, doll-like eyes
- Wig-cap or helmet hair, painted-on hairline
- Bald, shaved, or shiny scalp as the AFTER result
- Bright / light / studio-white backgrounds
- Watermarks, clip art, emoji, instructional text, category labels
- Any white border, white frame, white matte, white inner padding, or white box around the subject or photo
- DOUBLE-LINED gold borders / double gold rule frames around the canvas — strictly forbidden in every layout
- Full-canvas decorative borders or outlined card frames are discouraged; prefer letting the design breathe edge-to-edge with internal margins instead`
      : `ABSOLUTELY FORBIDDEN:
- Second person (no barber in frame), no hands, no scissors, no clippers, no cape, no chair, no salon, no mirror, no bottles
- Plastic / airbrushed / waxy skin, cartoon-symmetric faces, doll-like eyes
- Wig-cap or helmet hair, painted-on hairline
- Bald, shaved, or shiny scalp as the AFTER result
- Bright / light / studio-white backgrounds
- Watermarks, clip art, emoji, instructional text, category labels
- Any white border, white frame, white matte, white inner padding, or white box around the subject or photo
- DOUBLE-LINED gold borders / double gold rule frames around the canvas — strictly forbidden in every layout
- Full-canvas decorative borders or outlined card frames are discouraged; prefer letting the design breathe edge-to-edge with internal margins instead`;

    const promoStyles = [
      `STYLE: "ATTENTION CITY MEN" stat-flyer. Tiny gold "— ATTENTION —" eyebrow tag with thin gold side rules at top. Massive bold white condensed display headline below it (one or two key words in metallic gold gradient). Three stacked icon-stat rows with circular gold-outlined badges containing simple gold line icons (people silhouettes, cap, calendar-check) and short bold uppercase 2-line statements (first 1-2 words gold, rest white). Thin gold dividers between rows. Gold geometric diamond accents in the corners. Bottom: wide pill-shaped METALLIC GOLD GRADIENT CTA button with a small calendar icon, bold black uppercase text, and a chevron ">".`,
      `STYLE: "GUARANTEED RESULTS" brushstroke poster. Tiny gold "— SAME DAY —" eyebrow tag at top. Huge distressed/textured WHITE display word with grain. Below it, a HUGE handwritten brushstroke-script word in metallic gold gradient, looks hand-painted with rough edges and paint spatter. Rough gold brushstroke underline. "BEFORE" and "AFTER" labels in white brushstroke script with small gold brush underlines, placed over the photo corners. A diagonal gold light streak between the two sides. Three small brushstroke feature rings at the bottom with gold icons + brushstroke gold word + small white uppercase subtitle. Bottom CTA: a rough hand-painted gold brushstroke banner with bold black uppercase text.`,
      `STYLE: "ENGINEERED HAIRLINES" minimal editorial — NO border, NO frame around the canvas. Headline top-left, broken across 2 lines, alternating white and gold gradient words (heavy condensed display, tight letter spacing). Tiny short gold rule under the headline. Small white "BEFORE" label bottom-left of the left half, "AFTER" bottom-right of the right half. Centered metallic gold gradient pill CTA button at the bottom with bold black uppercase text. Three small gold pagination dots below. Lots of negative space — typography is the hero.`,
    ];
    const promoStyle = promoStyles[layoutIndex % 3];

    const leanAiPrompt = `Premium barbershop / hair-restoration promo graphic on pure black (#0A0A0A). ${aspectInstruction}

THE ONLY THING THAT MATTERS: a beautifully designed BEFORE/AFTER promo that looks like a high-end Instagram ad.

PHOTO (the centerpiece, ~60% of the canvas):
A side-by-side BEFORE/AFTER of the SAME real-looking man.
- ${ethnicityDesc}. ${faceVariation}
- BEFORE (left): mild thinning crown / receding temples — never fully bald or shaved.
- AFTER (right): full natural restored hair, seamless hairline, barber-blended. Never bald, never wig-like.
- Both sides: same face, same beard, same wardrobe (plain dark shirt), same warm golden rim-lit lighting on a deep black background. Both heads fully visible with breathing room — never crop hair, ears, or chin.
- Hyper-real photo quality: visible skin pores, individual hair strands, single eye catchlight. NO second person, NO barber tools, NO props.

DESIGN — pick this one promo style and execute it cleanly:
${promoStyle}

Headline text — pick ONE and adapt to 5-8 bold uppercase words:
${headlineExamples}

${brandNameLine}

ABSOLUTE RULES:
- Black background only. No white backgrounds, no studio white, no white frames or boxes.
- Gold = metallic gradient (deep bronze #8B6914 → rich gold #D4AF37 → bright gold #F0D060), never flat.
- Real photographic man — no cartoon, no 3D render, no illustration.
- Never place text over faces.
- Output one finished promo image, no instructional text or labels.`;

    const prompt = hasReference
      ? `${stopAndReadPreamble}${criticalRulesBlock}
${storyReferenceBlock}
You are a world-class graphic designer creating a premium marketing image for a barbershop/hair replacement business. ${aspectInstruction}

${brandColorBlock}

LAYOUT:
${layoutInstruction}

${referencePhotoBlock}

TEXT ON THE IMAGE:
Context/mood of the post (for design inspiration ONLY — do NOT copy any of this text onto the image): "${strippedContent.substring(0, 200)}"
${variationTitle ? `Variation style: "${variationTitle}" -- use this as creative direction, not as visible text.` : ''}

YOUR HEADLINE — pick ONE from this list and adapt it into a bold 5-8 word headline. Do NOT invent your own — use one of these as a base:
${headlineExamples}
Adapt and rephrase your chosen example. Do NOT default to generic "reclaim your confidence" phrasing. Do NOT copy any text from the context/mood above.
${brandProfile.title ? `Brand name: "${brandProfile.title}"` : '(No brand name provided — do NOT invent or display any brand name on the image.)'}
CALL TO ACTION: You MUST include a clear, visible call-to-action on the image (e.g., "BOOK A FREE CONSULTATION", "DM TO SCHEDULE", "LINK IN BIO", "CALL NOW"). Place it in a contrasting banner, button-style box, or prominent text area near the bottom of the image.

DESIGN RULES:
1. The headline typography must be large and impactful. If a word does not fit on a single line, reduce the font size until it does. Never hyphenate or break a word across two lines. Bold, uppercase, impactful sans-serif or display font.
2. Background should be DARK and PREMIUM — ranging from deep black (#0D0D0D) to rich charcoal (#1A1A1A). Dark moody tones are welcome. The overall feel should be luxurious and cinematic. Avoid any light, bright, or medium-toned backgrounds.
3. Text must have extremely high contrast against the black background. Alternate between WHITE and GOLD (#D4AF37) text for visual punch — gold on key impactful words, white on the rest. This white-and-gold alternating pattern is MANDATORY for every headline.
4. Include subtle decorative elements: thin line dividers, small geometric accents, or minimal border frames. Use gold/metallic tones for these accents.
6. No watermarks, no placeholder text, no clip art, no illustrations, no cartoons.
7. ${isStory ? 'VERTICAL 9:16 format — content stacked top to bottom, optimized for mobile full-screen viewing.' : 'SQUARE format — perfectly balanced composition.'}
8. Never display category labels, slugs, or metadata (like "hair-system") as visible text on the image. Category context should inform the design style, not appear as text.
9. Person framing: Never crop or cut off a person's head, hair, forehead, or face at any edge of the image — top, bottom, left, or right. The full head including all hair must be visible with breathing room on every side. Scale the photo smaller if needed to achieve this. In before-and-after photos, this applies to both the 'before' person and the 'after' person independently.
10. Never place text over faces — headlines, brand names, and decorative elements must be positioned in areas that do not overlap with any person's face.
11. The reference photo is a provided photo layer — preserve every pixel exactly as provided. Do not apply color grading, filters, or lighting changes to the person in the photo.
12. Never invent, fabricate, or use placeholder business names. If no brand name was provided above, do not write any made-up name on the image. Leave the brand name area empty or omit it entirely. Only display a brand name if one was explicitly provided.
13. GOLD ACCENTS — MANDATORY: Every image MUST prominently feature METALLIC GOLD GRADIENT (transitioning from deep bronze #8B6914 through rich gold #D4AF37 to bright gold #F0D060) as a signature design element. Every gold element must have this gradient shimmer like polished gold foil — never flat single-tone gold. AT MINIMUM: (a) a thin metallic gold outer border/frame around the entire image, AND (b) metallic gold gradient text on at least 2-3 key headline words, AND (c) at least one additional metallic gold element such as a gold dotted-line divider, gold CTA button/banner, or gold decorative accent.

Make this look like something a premium brand would actually post on Instagram.

=== Final verification — do this before outputting ===
1. Does your image contain any human face or body? If yes, is it from the provided reference photo with the exact same pixels? If you generated a new person, remove them and redo with the reference photo only.
2. The reference photo is the only source of human imagery allowed. No exceptions. No "inspired by" versions. The actual photo pixels.
3. Check all four edges of the image (top, right, bottom, left). Is any person's head or hair touching or cut off at any edge? If yes, scale the photo smaller and reposition it with padding on all sides.
4. Does the reference photo show a before-and-after transformation (two people/views)? If yes, check each person's head separately — can you see the complete hair, forehead, and face of both people with space around them? If either person's head is cropped at any edge, scale the entire photo smaller and redo.
5. Pixel check: Compare every human face in your output to the reference photo. The face must be identical — same lighting, same angle, same skin texture, same background behind them. If any face looks "cleaner", "sharper", or "different" from the reference, you generated a fake person. Remove it and use the real photo.
6. Important: Do not render any instructional text, labels, or keywords as visible text on the image. The only visible text should be the headline, brand name (if provided), and the call-to-action.
7. If you failed any check above, do not output the image. Redo it from scratch.`
      : leanAiPrompt;

    console.log('Generating marketing image via Google AI Studio:', { index: layoutIndex, contentType, tone, brand: brandProfile.title, palette, size, hasReference, ethnicity, ethnicityDesc });

    // CRITICAL: Push text prompt FIRST, then reference image
    // This ensures the model reads instructions before seeing the photo
    parts.push({ text: prompt });
    if (referenceImageData) {
      parts.push(referenceImageData);
    }

    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`;

    const requestBody = JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    let response: Response | null = null;
    const maxRetries = 3;
    const retryDelays = [0, 10000, 20000];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt + 1} after ${retryDelays[attempt] / 1000}s delay...`);
        await new Promise(r => setTimeout(r, retryDelays[attempt]));
      }

      response = await fetch(googleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      // Retry on rate limit OR transient server errors
      if (response.status === 429 || response.status === 503 || response.status === 500) {
        console.warn(`Got ${response.status} on attempt ${attempt + 1}, will retry...`);
        continue;
      }

      break; // Success or non-retryable error
    }

    if (!response || !response.ok) {
      if (response?.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded after retries. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = response ? await response.text() : 'No response';
      console.error('Google AI Studio error:', response?.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Image generation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const candidates = aiData.candidates;

    if (!candidates || candidates.length === 0) {
      console.error('No candidates in response:', JSON.stringify(aiData).substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: 'No image was generated. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the image part in the response
    const responseParts = candidates[0]?.content?.parts || [];
    let imageUrl: string | null = null;

    for (const part of responseParts) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      console.error('No image in response parts:', JSON.stringify(responseParts).substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: 'No image was generated. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Marketing image generated successfully via Google AI Studio:', { index: layoutIndex, palette, size, hasReference });
    return new Response(
      JSON.stringify({ success: true, imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating marketing image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
