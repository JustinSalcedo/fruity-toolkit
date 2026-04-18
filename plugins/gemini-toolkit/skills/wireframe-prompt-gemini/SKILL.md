---
name: wireframe-prompt-gemini
description: Generate UI **wireframe** prompts optimized for Gemini Image models (gemini-2.5-flash-image, gemini-3.1-flash-image-preview). Use when the user wants a wireframe prompt for Gemini specifically, when targeting `/gemini-toolkit:imagine` or the Gemini REST API directly, or when a prior wireframe prompt is producing Gemini-specific defects (percent/pixel values leaking as rendered text labels, iOS chrome bleed on a lo-fi mobile wireframe, semantic inference overriding layout spec). Companion to `wireframe-prompt` — follow that skill for the base structure, then apply the Gemini-specific additions here.
---

Gemini Image has enough distinctive behavior that a single universal wireframe-prompt guide can't cover it accurately. This skill layers Gemini-tested additions on top of `wireframe-prompt`. Read `wireframe-prompt` first for Steps 1–6 of the core workflow; this skill augments those steps with what's verified to work against Gemini for wireframes specifically.

---

## What Gemini is good at (wireframes)

- **Clean Balsamiq-style output.** When the opening frame says *"rendered in uniform 2px black outline on white, like a Balsamiq mockup, not a UI design"*, Gemini produces output that genuinely reads as a wireframe, not a desaturated mockup. The positive-identity frame carries most of the load.
- **Short-label text rendering.** Same strength as with mockups — quoted labels ≤3 words render legibly and in the medium-gray tone specified.
- **Reading-order layout.** Top-to-bottom descriptions map to vertical position on the canvas. Spatial anchors (`below the card`, `pinned to the bottom`) are honored.
- **Aspect ratio hints.** `390×844 (phone portrait)` and `1440×900 (desktop landscape)` both produce correctly proportioned canvases (at internal rescaled pixel sizes — treat the dimensions as shape hints, not pixel specs).
- **Placeholder conventions.** When the conventions block (Step 2.4) lists X-boxes, gray-bar stacks, plain avatar circles, and single-stroke icons, Gemini applies them consistently across the canvas.

## What Gemini gets wrong by default (wireframes)

These are priors the model applies even when the prompt is otherwise clean. Plan the prompt around them from the start.

1. **Numeric-unit text leak (confirmed on Phase B run 2026-04-17).** Any `<number> <unit>` token written inside the layout description is at risk of being rendered as a literal label in the output image. Observed values that leaked: `60 percent`, `35 percent`. Same prior as the pixel-value leak documented in `mockup-prompt-gemini` — but on wireframes it is **more consequential** because bar widths are often the most natural thing to describe numerically, and a leaked `"60%"` inside a stat-card destroys both `text_fidelity` and `no_polish` on the rubric. Rule: **never write numeric-with-unit specs inside Step 2.3 (layout description)**. Express widths qualitatively (`wide`, `medium`, `short`, `full-width`, `two-thirds-width`). Keep numeric values only in Step 2.2 (palette) and Step 2.4 (conventions).
2. **Section-name semantic inference overrides spec (confirmed Phase B v1).** When a section is named with a strong semantic prior (e.g. "Recent", "Archive", "Drafts"), Gemini may infer its layout from the name instead of following a spec that says "same as the section above." Observed: a `Recent` section whose spec read *"same layout as Upcoming"* (circles + bars + chevron) rendered with X-box image placeholders instead, because Gemini inferred "Recent = older items = thumbnails." Rule: **duplicate the row layout rather than back-referencing it**, and add an explicit exclusion: *"Recent rows ALSO use plain gray circles on the left, not X-boxes — every row follows the Upcoming row layout identically."*
3. **iOS chrome bleeds in — same as mockups.** Home indicator bar, rounded screen corners, faint device-frame border. The extended fullscreen negative block in `wireframe-prompt` Step 2.5 handles most of this, but the home indicator or subtle corner rounding can flicker back on any given run. Budget 1–2 reruns if these cost points on `no_device_chrome`.
4. **Carousel-peek prior is weaker on wireframes than on mockups, but still present.** Because wireframes lack the brand-card semantic substrate (no color, no glossy hero), Gemini is less prone to render a sibling-card peek. Phase B Screen 1 v1 did show one carousel sliver on the primary span card; v2 cleared it with standard positive framing (*"the primary card is alone between solid white margins"*) in a single iteration. The full escape-hatch restructure from `mockup-prompt-gemini` is rarely needed for wireframes — positive framing usually suffices.
5. **Icon detail re-creep.** Gemini may render nav icons with full detail (magnifying-glass handle, bell clapper, gear teeth) even when told "outline only." Specify bounding box + single-stroke + explicit "no detail, glyph silhouette only."
6. **Model commentary in the response.** Gemini may return a `text` part alongside the image describing what it drew. Downstream code should treat `text` as optional — `gemini-toolkit:imagine` already handles this.
7. **MIME rewrite to JPEG.** Gemini often returns `image/jpeg` even when the prompt implies PNG. `/gemini-toolkit:imagine` auto-corrects the output path's extension; if calling the API directly, inspect `inlineData.mimeType` before writing.

## Gemini-specific operational facts

- **No separate negative-prompt field.** Unlike Stable Diffusion, there's no way to pass negatives out-of-band. They go inline in the main prompt, in a single trailing block (exactly as `wireframe-prompt` Step 2.5 prescribes).
- **Markdown bolding is ignored but harmless.** Keep the `**...**` bolding on the negative block — it's visually obvious to human readers without costing anything in the output.
- **Placement of the numeric-leak negative.** The line *"No numeric width or size specifications rendered as text — no '60%', no '16px', no '2px', no dimensions of any kind visible as labels inside the UI"* belongs inside the Step 2.5 negative block. It is cheap, specific, and the most effective patch for the leak prior after qualitative-width rewriting.

## Escape hatch: reframe identity to kill "colored UI" prior

If the `grayscale_purity` score is <60 after two runs with the negative block + Balsamiq positive framing, don't add a third layer of words. Reframe what the image IS:

> This is an architect's drafting of a UI layout, drawn in black pen on white paper. The output is NOT a UI screenshot, NOT a design mockup, NOT a finished app. It is a schematic diagram. Every line is pure black #000000. Every interior fill is pure white #FFFFFF except where an explicit placeholder gray (#EEEEEE, #CCCCCC, #666666) is specified. There are no pixels of any other color anywhere in the image.

Principle (same as `mockup-prompt-gemini`): the `"app screen"` substrate is what the color prior attaches to. Redefine the image as a drafting, not an app screen, and the color prior has nowhere to live.

## Regression signal: when the score goes down, stop adding words

Same rule as `mockup-prompt-gemini`. If the **weighted rubric score regresses** between iterations (v(n) lower than v(n-1)), that's signal not noise:

1. Added words are fighting an already-activated prior, strengthening it.
2. The model is reading the growing list of negatives as a *description* of what the image should include, not exclude.

When this happens, stop accumulating text. Apply one of:
- **Restructure.** Remove sections — a wireframe that doesn't converge is often trying to be a mockup.
- **Shorten.** Remove half the negative block and rerun.
- **Reframe.** Apply the escape hatch above.
- **Drop fidelity.** If lo-fi is fighting back, drop to sketch mode — hand-drawn framing breaks many of these priors in one move.

## Iteration loop with `gemini-toolkit:imagine`

```bash
/gemini-toolkit:imagine --output /tmp/wireframe-run1.png <your prompt>
```

Budget 2 runs per screen for wireframes (tighter than mockups' 2–3 — wireframes converge faster because the structural constraints are fewer). Inspect against `wireframe-prompt` Step 4's defect table, patch, rerun.

## Reference prompt (verified against Gemini 3.1-flash-image-preview, Phase B, weighted score 98/100)

Concrete example of a lo-fi mobile wireframe prompt that exercises every Gemini-specific guardrail documented here. Good starting template; adapt the scene, keep the structure.

```
A flat, fullscreen lo-fi wireframe of a mobile UI, 390x844 aspect ratio (phone portrait), straight-on, strict grayscale only, no device frame, solid white canvas edge to edge with square corners. Rendered in uniform thin black outline on white, like a Balsamiq mockup, not a UI design.

Strict grayscale only. Canvas pure white. Container outlines pure black at uniform thin stroke. Secondary fills light gray. Placeholder fills medium light gray. Rendered text labels in medium gray, never pure black. No tinted grays — all grays are pure neutral. No other colors anywhere.

Top section reads "Current Watch" as a short header label in medium gray, aligned left. Below the header, a full-width timeline strip — a thin horizontal line with three small labeled tick marks "Prev", "Now", "Next", medium gray.

Below the timeline, a large primary span card occupying roughly the upper third of the screen height, outlined rounded rectangle, no fill, no drop shadow. The card stretches edge to edge with generous side margins — the space to the left and right of the card is solid white canvas, the same as the rest of the screen; there are no other cards, no carousel, no content peeking from either side. Inside the card: a small label reading "Selected" at the top-left corner; centered in the upper half, a wide bold horizontal gray bar representing the big elapsed-time readout; centered below that, a shorter thinner horizontal gray bar representing the ceiling-time readout; at the bottom of the card a row of three circular outline buttons evenly spaced, each with a single-stroke outline icon inside.

Below the primary card, a section header reads "Upcoming" in medium gray. Three rows below it — each row is a thin full-width rectangle with small side margins, outlined. Each row contains a plain gray circle on the left, two stacked horizontal gray bars of medium and short width for the name and time, and a single-stroke outline chevron icon on the right.

Below the Upcoming list, a section header reads "Recent" in medium gray. Two rows below it in exactly the same avatar-plus-stacked-bars layout as Upcoming. Recent rows ALSO use plain gray circles on the left, not X-boxes — every row follows the Upcoming row layout identically.

A bottom tab bar pinned to the bottom spans full width, outlined, moderate height, containing four evenly spaced single-stroke outline icons — no labels, no fill, no color. The first icon has a thin underline beneath it to indicate the active tab.

Placeholder conventions, applied everywhere: image placeholder is a rectangle with a single thin diagonal X from corner to corner, empty interior, no photography. Text body is a stack of horizontal gray bars of decreasing length, thin uniform thickness, medium gray. Avatar is a plain gray circle, uniform fill, no face. Icon is single-stroke outline in a compact bounding box, no fill, no color. Button is a rounded rectangle outline with a quoted short label inside. Card is a rounded rectangle outline, no drop shadow, no gradient. Everything is 2D, flat, uniform line weight.

**No color. No brand colors. No blue, green, red, orange, yellow, purple, or tinted gray. No gradients. No drop shadows. No glassmorphism. No 3D depth. No realistic photography inside placeholders. No rendered imagery. No detailed icons — outlines only. No numeric width or size specifications rendered as text — no "60%", no "16px", no "2px", no dimensions of any kind visible as labels inside the UI. No phone frame. No device bezel. No hardware. No perspective tilt. No notch, no Dynamic Island, no iOS home indicator. No rounded screen corners — canvas corners are square. No sibling cards or carousel peeking from the edges — exactly one screen, the primary card is alone between solid white margins. No tool chrome, no Figma or Sketch artboard label, no ruler, no canvas grid visible. No "wireframe" watermark. The image reads as a wireframe, not a finished design.**
```

On the multi-span timer home screen above, this prompt produces a clean lo-fi wireframe with correct placeholder conventions, strict grayscale, and no numeric leak; a very faint home-indicator line or subtle rounded canvas corner may flicker on any given run — if it matters, budget one rerun.

---

## Output Format

Same as `wireframe-prompt` — return the prompt in a labeled code block. When correcting an existing output, follow with a diagnostic table, and call out which defects are Gemini-specific priors (numeric leak, section-name inference, iOS chrome flicker) vs. model-agnostic issues so the user knows which may recur on reruns.
