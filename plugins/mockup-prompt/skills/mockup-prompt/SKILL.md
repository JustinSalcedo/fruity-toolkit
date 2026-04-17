---
name: mockup-prompt
description: Generate guardrail-enforced prompts for AI image generation models (GPT Image, Ideogram, FLUX, Midjourney, Stable Diffusion, etc.) when the user wants to create a UI mockup image. Triggers include "generate a mockup prompt", "write a prompt for a UI mockup", "create an image generation prompt for my app screen", or any request to produce a text prompt that will be fed to an image model to render a mobile or desktop interface. Also triggers when the user wants to improve or correct an existing mockup prompt (e.g. "the phone frame is showing", "the background is white", "the text is garbled"). For Gemini Image specifically, prefer `mockup-prompt-gemini`, which layers model-specific guardrails on top of this one. Do NOT use for building actual UI components in code (use frontend-design instead), or for general image generation unrelated to UI/app screens.
---

This skill produces precise, guardrail-enforced text prompts for AI image generation models tasked with rendering UI mockups. Its primary goal is to prevent the most common failure modes: device hardware bleeding in, perspective distortion, white or gray backgrounds, and garbled/hallucinated text.

The user provides a description of the screen they want rendered: app type, key UI sections, color palette, and any reference images or existing prompts to correct.

---

## Step 1 — Clarify Output Mode

Before writing, determine which of these two modes applies:

**A) Fullscreen / Screenshot mode** — The output is a flat, straight-on screen capture with no device, no background, no bezel. Use when the user wants a clean UI asset for design handoff, documentation, or further editing.

**B) Device Mockup mode** — The UI is displayed inside a specific phone or tablet model, shown at an angle or floating on a colored background. Use when the user wants a marketing or presentation image.

If the user hasn't specified, **default to Fullscreen mode**. It is more versatile, avoids perspective distortion, and produces text that is easier for image models to render correctly.

---

## Step 2 — Prompt Structure

Always build the prompt in this exact order. Do not skip sections.

### 2.1 — Output Declaration (first sentence)
State the format, render mode, and aspect ratio up front. This anchors the model before any visual details are introduced.

Note on dimensions: most image models don't output at the pixel size you request. The numbers act as a **semantic hint for composition and aspect ratio**, not a literal output spec. Use the familiar device dimensions (390×844, 1440×900) so the ratio reads as "phone portrait" or "desktop landscape" to the model.

**Fullscreen example:**
> A flat, fullscreen mobile UI screenshot, straight-on, 390×844 aspect ratio (phone portrait), no device frame, no background, screen fills canvas edge to edge with square corners.

**Device Mockup example:**
> A high-fidelity mobile UI mockup displayed on a floating [iPhone 15 Pro / Pixel 8 / Samsung Galaxy S24], soft drop shadow, clean [color] background, [angle: straight-on / slight tilt / isometric].

### 2.2 — Color Foundation
State the background color of the UI itself using a hex code. Ambiguous terms like "dark" or "light" lead to inconsistent results.

> Dark navy (#0D1B2A) app background.

### 2.3 — Layout Description (top to bottom)
Describe the screen in reading order: status bar → header → body sections → bottom nav. Each section gets one sentence. Use spatial anchors ("top-left", "below the card", "pinned to the bottom").

- Keep each UI label short (1–4 words). Long strings hallucinate.
- For numbers, write them exactly as they should appear: `$12,480.50`, not "twelve thousand dollars".
- For icons, describe their shape/color rather than their name: "a purple shopping bag icon", not "the Shopping icon".

### 2.4 — Typography & Style Keywords
Close the descriptive section with 3–6 style keywords that set the aesthetic register for the model.

> Clean sans-serif typography, glassmorphism cards, 16px rounded corners, soft purple accents, fintech aesthetic, pixel-perfect.

### 2.5 — Hard Negative Block (last, always)
This is the most important guardrail. Always end the prompt with a bolded, explicit negative instruction block. Image models weight the end of a prompt heavily.

**For Fullscreen mode — always include this exact block:**
> **No phone. No device frame. No bezel. No hardware. No 3D perspective. No tilt. No white background. No gray background. No drop shadow behind the screen. No rounded screen corners — canvas corners are square. No iOS home indicator bar. No notch, no Dynamic Island, no status-bar cutout. No sibling cards or carousel peeking from the edges — the canvas shows exactly one screen. Screenshot only. UI fills the entire canvas.**

The four less-obvious additions — square canvas corners, no home indicator, no notch, no carousel overflow — are what separates a "clean UI asset" from "a photo of an iOS app." Without them, image models default to iOS chrome and swipeable card layouts for anything that looks like a fintech or social app.

### 2.5.1 — Positive framing beats negation for strong priors

Some layouts have very strong model priors that the negative block alone won't overcome. Fintech "balance card" = swipeable carousel is the canonical example; even `No sibling cards` and `exactly one screen` don't always win against it. When a defect reappears after two runs, rewrite the defect area in **positive framing** inside the body — describe *what is* there, not *what isn't*:

- Weak: `No sibling cards at the edges.` → (still adds a carousel peek)
- Strong: `The card stretches edge to edge, occupying the full width of the screen with 16px margins on both sides. The space to the left and right of the card is solid #0D1B2A navy background, the same as the rest of the screen.` → (denies the carousel a semantic opening)

Same principle applies to "no background color" (say "the app screen extends to the canvas edges on all four sides"), "no device frame" (say "the UI starts at pixel 0,0 of the canvas"), etc.

**For Device Mockup mode — always include this:**
> **No visible background desktop or OS chrome. No extra devices. No floating UI elements outside the screen. Screen content must be sharp and straight, not warped or distorted.**

---

## Step 3 — Text Rendering Guardrails

Garbled in-UI text is the most common defect. Apply all of the following:

1. **Wrap all UI strings in quotation marks** inside the prompt body: `label reading "Send"`, `button text "View All"`.
2. **Keep every label to 1–3 words.** Never write a sentence-length string and expect it to render legibly.
3. **Avoid special characters** in UI copy within the prompt (%, @, #, &). Spell them out: "plus sign", "percent".
4. **Repeat critical text twice** in the prompt if it must be accurate: once in context, once in a summary line. Example: `The balance card reads "$12,480.50". Ensure "$12,480.50" is rendered legibly in bold white.`
5. **For Ideogram**: Wrap all target text in quotation marks directly in the prompt — this is explicitly documented to improve text rendering accuracy.
6. **For FLUX/Stable Diffusion**: Prefer shorter prompts with fewer distinct text strings. Each additional label reduces accuracy for all others.

---

## Step 4 — Corrective Prompts (fixing existing outputs)

When the user provides an image that has defects, diagnose first, then patch the prompt.

| Defect observed | Diagnosis | Corrective addition |
|---|---|---|
| Phone frame / bezel visible | Mode conflict or missing negative | Add fullscreen output declaration + full negative block |
| White / gray background | Background bleed | Add "UI fills canvas edge to edge, no background color outside the app" |
| 3D tilt / perspective warp | Missing straight-on anchor | Add "straight-on, flat, zero perspective distortion, no tilt, no isometric angle" |
| Garbled / misspelled text | Too many strings or too long | Reduce labels to ≤3 words, wrap in quotes, repeat key strings |
| Missing bottom nav | Prompt ended before full layout | Explicitly describe the bottom nav as the last layout item before the negative block |
| Color looks wrong | No hex codes | Replace all color names with hex codes |
| Inconsistent icon style | Icons described by name | Describe by shape + color: "small purple pill-shaped button with a paper plane icon" |
| Rounded screen corners on the canvas | Residual iOS chrome | Add "square canvas corners, no rounded screen mask" |
| Horizontal bar at the bottom of the canvas | iOS home indicator bleed | Add "no iOS home indicator bar, no gesture bar at the bottom" |
| Notch / Dynamic Island cutout visible | Device-top chrome bleed | Add "no notch, no Dynamic Island, no status-bar cutout" |
| A sibling card peeks from the edge | Model inferred a carousel | Add "no carousel, no horizontal overflow, no sibling cards visible at the edges — exactly one screen" |
| Bottom-nav icons are outlined when you asked for solid | Weight/style drift | Specify fill: "solid white filled icon" instead of "small white icon" |
| Carousel peek persists after 2 runs with positive framing | Model prior for fintech/social = swipeable | Change the hero shape — full-width banner, tall (≥40% height) hero card, or drop the card pattern entirely in favor of a list-first layout |

---

## Step 5 — Model-Specific Notes

| Model | Key consideration |
|---|---|
| **GPT Image 1.5** | Best overall prompt adherence. Use plain language for revisions. One image per call — build the full prompt upfront. |
| **Ideogram 3.0** | Best text rendering. Always wrap UI strings in quotes. Specify `--style realistic` or `--style design` if using the API. |
| **FLUX.2 Pro** | Best photorealism. Fewer text strings = better quality. Use for visual-heavy screens with minimal copy. |
| **Midjourney v7** | Add `--ar 9:19` for portrait mobile ratio. Append `--style raw` to reduce over-stylization. Use `--no phone, bezel, background` for negative terms. |
| **Stable Diffusion 3.5** | Use the negative prompt field (separate input) for all "no X" terms rather than embedding them in the main prompt. |
| **Gemini Image** | See the companion `mockup-prompt-gemini` skill — it has Gemini-tested additions (strongest-prior escape hatches, stochastic-defect retry guidance, and a reference prompt). |

---

## Step 6 — Verify and Iterate

After generating the prompt, test it against the target model and inspect the output for the defects in Step 4's table. For each defect you see, apply the corresponding corrective and regenerate.

Two iterations are usually enough; if three doesn't converge, the prompt is over-constrained — simplify the layout or split into two screens.

When the user is targeting Stable Diffusion or FLUX locally, an `--output` preview loop is fast. For hosted models (GPT Image, Ideogram, Midjourney), submit via the model's own UI/API and paste the result back for the next correction pass.

---

## Output Format

Return the completed prompt in a clearly labeled code block so the user can copy it directly. Follow it with a short diagnostic table if correcting an existing output, listing each defect found and which guardrail addresses it.
