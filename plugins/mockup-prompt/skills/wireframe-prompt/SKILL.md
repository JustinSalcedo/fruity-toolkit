---
name: wireframe-prompt
description: Generate guardrail-enforced prompts for AI image generation models (GPT Image, Ideogram, FLUX, Midjourney, Stable Diffusion, etc.) when the user wants to create a low-fidelity, grayscale UI **wireframe** image (not a finished mockup). Triggers include "generate a wireframe prompt", "make a lo-fi wireframe for my app screen", "write a Balsamiq-style prompt for this flow", or any request to produce a text prompt that will be fed to an image model to render structural, pre-visual UI. Sibling to `mockup-prompt` — use `mockup-prompt` for high-fidelity branded visuals; use this skill for structural, pre-commitment artifacts in black/white/gray. For Gemini Image specifically, prefer `wireframe-prompt-gemini`, which layers model-specific guardrails on top of this one. Do NOT use for building actual UI components in code, or for general grayscale image generation unrelated to UI screens.
---

This skill produces precise, guardrail-enforced text prompts for AI image generation models tasked with rendering UI **wireframes**: low-fidelity, grayscale, structural renders that communicate information architecture without committing to visual design. Its primary goal is to prevent the most common wireframe failure modes: colored/finished-UI bleed, photographic content inside image placeholders, shadow-and-polish drift, and lorem-ipsum rendered as colored blocks.

The user provides a description of the screen they want wireframed: app type, key sections, platform, and (optionally) existing copy from the project.

**Why a dedicated wireframe skill?** A wireframe is not a "desaturated mockup." Wireframes use explicit placeholder conventions (X-crossed image boxes, stacked text bars, plain circle avatars) that communicate intent *faster* than a rendered version would. Mockup prompts optimize for visual polish; wireframe prompts optimize against it.

---

## Step 1 — Clarify Fidelity Level

Before writing, determine which fidelity level applies. Default to **lo-fi** unless the user specifies otherwise.

**A) Sketch** — hand-drawn, marker-on-paper aesthetic. Rough strokes, slight imperfection, white-paper background. Good for earliest IA discussion when the point is "this is not a commitment."

**B) Lo-fi (default)** — clean digital wireframe, thick uniform strokes, obvious placeholder markers (X-box for images, stacked gray bars for text, plain circles for avatars). Balsamiq-style. Good for stakeholder review.

**C) Mid-fi** — cleaner lines, real short copy instead of placeholder bars, restrained gray tonal range (still no color). Bridges toward mockup territory.

If the user hasn't specified, default to **lo-fi**. It reads most clearly as "a wireframe, not a draft design" — which is the whole point.

---

## Step 2 — Prompt Structure

Build the prompt in this exact order. Do not skip sections.

### 2.1 — Output Declaration (first sentence)
State the artifact type ("wireframe"), fidelity level, strict grayscale, and aspect ratio up front. This anchors the model before any content is described.

Dimensions are a semantic hint for composition/aspect ratio, not a literal output spec (same rule as `mockup-prompt`). Use familiar device dimensions (390×844, 1440×900) so the ratio reads as "phone portrait" or "desktop landscape."

**Lo-fi mobile example:**
> A flat, fullscreen **lo-fi wireframe** of a mobile UI, 390×844 aspect ratio (phone portrait), straight-on, **strict grayscale only**, no device frame, solid white canvas edge to edge with square corners.

**Lo-fi desktop example:**
> A flat, fullscreen **lo-fi wireframe** of a desktop web UI, 1440×900 aspect ratio (desktop landscape), straight-on, **strict grayscale only**, solid white canvas edge to edge.

**Sketch mode:** swap "lo-fi wireframe" for "hand-drawn sketch wireframe, rough marker strokes on white paper."

### 2.2 — Grayscale Palette Declaration
Replaces the mockup `Color Foundation`. Specify the exact grayscale palette with hex codes. Ambiguity here is the #1 cause of color bleed.

> **Strict grayscale only.** Canvas #FFFFFF. Container outlines #333333 at 2px uniform stroke. Secondary fills #EEEEEE. Placeholder fills #CCCCCC. Text rendered as medium-gray #666666 horizontal bars. No other colors anywhere — no blues, no brand accents, no greens, no reds, no tinted grays.

The explicit "no tinted grays" entry matters: without it, models sometimes sneak in a cool-blue or warm-beige tint on the container fills and the wireframe reads as a desaturated mockup.

### 2.3 — Layout Description (top to bottom)
Describe the screen in reading order using placeholder markers, not real UI flourishes. Each section gets one short sentence with a placeholder-type annotation.

Rules:
- Labels that ARE rendered (button text, section headers, nav items) stay 1–3 words and go in quotes — same as `mockup-prompt` Step 3.
- Body copy does NOT render as real text. Describe bar stacks qualitatively: `[stacked horizontal gray bars of decreasing length, thin uniform thickness, medium gray]`.
- Images use `[rectangle with a single thin diagonal X from corner to corner, empty interior]`.
- Avatars use `[plain gray circle, no face, no content]`.
- Icons use `[single-stroke outline icon, compact bounding box, no fill]`.

**Describe widths and sizes qualitatively, not numerically.** Write `wide`, `medium`, `short`, `full-width`, `two-thirds-width`, `narrow` — not `60%`, `35%`, `200px`. Numeric-with-unit tokens in the layout description are at risk of leaking as literal rendered text in the output image (`"60%"` printed inside the UI). Keep numeric values in Step 2.2 (palette) and Step 2.4 (conventions) only.

### 2.4 — Placeholder Conventions Block
Replaces the mockup `Typography & Style Keywords` section. Explicitly list the visual vocabulary so the model does not invent its own. Keep this block verbatim (minor adjustments for fidelity level).

> **Placeholder conventions, applied everywhere:** Image placeholder = rectangle with a single thin diagonal X from corner to corner, empty interior, no photography. Text body = stack of horizontal gray bars of decreasing length, thin uniform thickness, medium-gray #666666. Avatar = plain gray circle, uniform fill, no face or silhouette. Icon = single-stroke outline in a compact bounding box, no fill, no color. Button = rounded rectangle with a quoted short label inside, outline only. Card = rounded rectangle outline, no drop shadow, no gradient, no depth. Input field = thin rectangle with a short placeholder-bar inside. Everything is 2D, flat, uniform line weight.

### 2.5 — Hard Negative Block (last, always)
Most important guardrail. Always end the prompt with a bolded, explicit negative block. Image models weight prompt ends heavily.

**Lo-fi / mid-fi wireframe — always include this exact block:**
> **No color. No brand colors. No blue, green, red, orange, yellow, purple, or tinted gray. No gradients. No drop shadows. No glassmorphism. No 3D depth. No realistic photography inside placeholders. No rendered imagery. No detailed icons — outlines only. No numeric width or size specifications rendered as text — no "60%", no "16px", no "2px", no dimensions of any kind visible as labels inside the UI. No lorem ipsum rendered as colored blocks. No phone frame. No device bezel. No hardware. No perspective tilt. No notch, no Dynamic Island, no iOS home indicator. No rounded screen corners — canvas corners are square. No sibling cards or carousel peeking from the edges — exactly one screen. No tool chrome, no Figma/Sketch artboard label, no ruler, no canvas grid visible. No "wireframe" watermark, no label annotating the image type. The image reads as a wireframe, not a finished design.**

The final positive-framing sentence (*"The image reads as a wireframe, not a finished design"*) is intentional — see Step 2.5.1.

**Sketch mode — replace the first sentence with:** *"No color — marker strokes are pure black #000000 on white paper #FFFFFF only."* The rest of the block applies unchanged.

### 2.5.1 — Positive framing beats negation for strong priors
Same principle as `mockup-prompt`. Some priors are too strong to negate — when a defect reappears after two runs, rewrite the defect area in **positive framing** inside the body. Wireframe-specific examples:

- Weak: `No color.` → (still renders a blue primary button)
- Strong: `The primary button is a thin 2px black outline rectangle with the label "Submit" in medium gray. The button interior is solid #FFFFFF — no fill color of any kind.`

- Weak: `No rendered photography.` → (still puts a stock-photo face in the hero)
- Strong: `The hero image area is a rectangle bounded by a thin black outline, with a single thin black diagonal line from top-left corner to bottom-right corner, and nothing else inside — no photo, no illustration, no person, no object.`

---

## Step 3 — Text Rendering Guardrails

Garbled text defeats a wireframe just as it defeats a mockup — *and* any colored or oversized text defeats the grayscale premise.

1. **Rendered labels** (section headers, button text, nav items) follow `mockup-prompt` rules: ≤3 words, in quotation marks, no special characters.
2. **Body copy is NOT rendered as text.** Replace with stacked horizontal gray bars. Example: instead of `"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor..."` write `[stacked gray bars of decreasing length]`.
3. **Never write "lorem ipsum" in the prompt.** Some models render it as a solid colored block or as actual Latin text in a playful serif. Say "placeholder text bars" instead.
4. **Rendered text color is medium-gray #666666**, never pure black — pure black labels read as "final copy" not "wireframe."
5. **Numbers that must render exactly** (e.g. "42" in a stat card) follow the `mockup-prompt` double-mention rule: quote once in context, repeat once as a verification line.
6. **Never write numeric-with-unit tokens** (`60%`, `16px`, `2em`) inside the layout description — they can leak as rendered text labels in the image. Express widths qualitatively instead.

---

## Step 4 — Corrective Prompts (fixing existing outputs)

When the user provides a wireframe that has defects, diagnose first, patch second.

| Defect observed | Diagnosis | Corrective addition |
|---|---|---|
| Colored UI rendered instead of wireframe | Prior activated — model read "wireframe" as aesthetic hint only | Add positive framing: *"rendered in uniform 2px black outline on white, like a Balsamiq mockup, not a UI design"*; reinforce strict grayscale palette |
| Tinted gray (blue-gray, warm beige) in fills | Grayscale not locked with hex | Replace all color words with hex codes; add *"no tinted grays — all grays are pure neutral (#EEEEEE, #CCCCCC, #666666, #333333)"* |
| Realistic photo inside image placeholder | Missing positive X-box framing | Replace with *"rectangle with a single thin diagonal X line from top-left to bottom-right, empty interior, no photo, no illustration"* |
| Lorem ipsum rendered as colored block or playful serif | Text substrate activated a style prior | Switch to `[stacked horizontal gray bars of decreasing length]` everywhere body copy appears; remove the word "text" in that region |
| Drop shadows / depth / rendering polish | "Card" prior pulls in 3D treatment | Add *"flat, uniform 2px line weight, no shadows, no depth, no gradients, no fills except the explicit placeholder grays"* |
| Icons drawn with detail or color | Icon prior pulled in brand assets | Specify *"single-stroke outline icon in a 24×24 bounding box, 2px thick, no fill, no color, no details — glyph silhouette only"* |
| Tool chrome (artboard label, toolbar, ruler) | Model thinks it's drawing a tool screenshot | Add *"no tool chrome, no artboard label, no ruler, no grid overlay, no canvas frame — the image IS the wireframe, not a screenshot of editing one"* |
| Phone frame / bezel visible | Mode conflict or missing negative | Add fullscreen output declaration + full negative block (inherited from `mockup-prompt`) |
| Notch / Dynamic Island / home indicator on mobile wireframe | iOS chrome bleed | Inherit the `mockup-prompt` fix; on Gemini, see `wireframe-prompt-gemini`'s reframing escape hatch |
| Real icons/glyphs rendered with filled detail | Default bottom-nav prior | Specify *"each nav icon is a single-stroke outline silhouette — magnifying-glass outline only, no fill, no handle detail"* |
| "Wireframe" text label rendered on the image itself | Model hallucinated a watermark | Add *"no 'wireframe' watermark, no label annotating the image type, no text outside the UI itself"* |
| Numeric spec (e.g. "60%", "16px") rendered as literal UI text | Numeric-unit text leak — any `<number><unit>` in the layout description is at risk | Rewrite widths/sizes qualitatively in the layout (`wide`, `medium`, `short`, `full-width`, `two-thirds-width`); keep numeric values only in Step 2.2 (palette) and Step 2.4 (conventions) |
| Percent or pixel leak persists after qualitative rewrite | Numeric token anywhere near a rendered bar | Drop the number entirely — models can choose a reasonable width from `"wide horizontal gray bar"` alone |
| Section-name inference overrides layout spec (e.g. "Recent" rows rendered with X-box placeholders even though spec said "same as Upcoming") | Model applied a semantic prior to the section name instead of the referenced layout | Duplicate the row layout instead of saying "same as above"; add an explicit exclusion: *"Recent rows ALSO use plain gray circles on the left, not X-boxes — every row follows the Upcoming row layout identically"* |

---

## Step 5 — Model-Specific Notes

| Model | Key consideration |
|---|---|
| **GPT Image 1.5** | Strong prompt adherence. The `"rendered in Balsamiq style"` positive frame works especially well. One image per call — include all corrections upfront. |
| **Ideogram 3.0** | Best text rendering. Keep rendered labels in quotes. Style hint: `--style design` produces cleaner wireframe lines than `--style realistic`. |
| **FLUX.2 Pro** | Photorealism prior is strong — it fights wireframe aesthetic. Lead with *"black pen on white paper, architectural drafting style"* as the opening frame. Keep rendered text minimal. |
| **Midjourney v7** | Add `--style raw` to kill stylization. `--no color, photo, shadow, gradient` is essential. Don't bother with Midjourney for mid-fi wireframes — it over-polishes. |
| **Stable Diffusion 3.5** | Use the separate negative-prompt field for all "no X" terms. Main prompt holds only the positive description. LoRAs tagged `wireframe` or `balsamiq` (community models) help dramatically. |
| **Gemini Image** | See the companion `wireframe-prompt-gemini` skill — it has Gemini-tested additions (numeric-unit leak avoidance, reframing escape hatch, section-inference override, and a verified reference prompt). |

---

## Step 6 — Verify and Iterate

After generating the prompt, test it against the target model and inspect the output against Step 4's defect table. Two iterations usually suffice. If three doesn't converge, the description is over-specified — simplify the layout or drop to sketch fidelity.

For wireframe work specifically: a wireframe that doesn't converge is often trying to be a mockup. When in doubt, remove sections (not words).

---

## Output Format

Return the completed prompt in a clearly labeled code block so the user can copy it directly. Follow it with:
1. The fidelity level chosen (sketch/lo-fi/mid-fi) and why.
2. A short diagnostic table if correcting an existing output, listing each defect found and which guardrail addresses it.
3. The target viewport and platform assumptions used.
