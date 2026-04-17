---
name: mockup-prompt-gemini
description: Generate UI mockup prompts optimized for Gemini Image models (gemini-2.5-flash-image, gemini-3.1-flash-image-preview). Use when the user wants a mockup prompt for Gemini specifically, when targeting `/gemini-toolkit:imagine` or the Gemini REST API directly, or when a prior mockup prompt is producing Gemini-specific defects (iOS home-indicator flicker, fintech carousel peek, rounded screen corners on a fullscreen render). Companion to `mockup-prompt` — follow that skill for the base structure, then apply the Gemini-specific additions here.
---

Gemini Image has enough distinctive behavior that a single universal mockup-prompt guide can't cover it accurately. This skill layers Gemini-tested additions on top of `mockup-prompt`. Read `mockup-prompt` first for Steps 1–6 of the core workflow; this skill augments those steps with what's verified to work against Gemini.

---

## What Gemini is good at

- **Text rendering.** Mixed copy, numbers, currency, and labels all render legibly as long as each label stays ≤3 words and important strings are quoted (both rules from `mockup-prompt` Step 3). Gemini currently beats or ties every other tested model on text fidelity.
- **Reading-order layout.** Top-to-bottom descriptions in the prompt map cleanly to vertical position on the canvas. Spatial anchors ("below the card", "pinned to the bottom") are honored.
- **Aspect ratio hints.** `390×844 aspect ratio (phone portrait)` in the output declaration produces a correctly proportioned image — though the pixel count is rescaled (typically to 704×1520 for phone portrait). Treat the dimensions as a shape hint, not an output spec.
- **Editorial serif display faces.** Large serif headings ("Good morning, Justin." in a literary-magazine serif) render with distinct letterforms, not generic sans. Useful for distinctive, non-template aesthetics.

## What Gemini gets wrong by default

These are priors the model applies even when the prompt is otherwise clean. Plan the prompt around them from the start — don't discover them on iteration two.

1. **iOS chrome bleeds in.** Home indicator bar, rounded screen corners, notch / Dynamic Island. The extended fullscreen negative block in `mockup-prompt` Step 2.5 handles most of this, but **the home indicator can flicker back on any given run** even when negated. If the user's use case cares, plan to rerun once or twice.
2. **Dynamic Island reasserts when you render a status bar.** Observed in the Ember run: v1 had no Dynamic Island; v2 added more device-chrome negatives → Gemini rendered a prominent Dynamic Island anyway. **The status bar is the semantic substrate that lets the Dynamic Island exist.** Fighting it with more negatives makes it stronger. See the reframing escape hatch below — it's the reliable fix.
3. **Fintech and social layouts get a horizontal carousel.** The single strongest Gemini prior observed in testing. A "balance card" or "feed card" will get a sibling card peeking from the right edge of the canvas even with:
   - The extended negative block (`No sibling cards or carousel peeking from the edges`),
   - Positive framing in the body (`The card stretches edge to edge … the space to the left and right is solid navy background`).
   The peek typically shrinks from prominent (~10% of canvas width) to a thin sliver (~2%) with those tactics but rarely disappears entirely. If it's unacceptable, go to the escape hatch below.
4. **Bottom-nav icons default to outlined.** Specify `solid white filled icon` explicitly — `small white icon` gets outlined.
5. **Model commentary in the response.** Gemini may return a `text` part alongside the image describing what it drew or caveating the output. Downstream code should treat `text` as optional.
6. **Pixel-value gap instructions leak as visible UI text.** Observed: `16px gap between rows` in the body produced literal "16px" labels rendered inside each row. Use word-form spacing (`tight spacing`, `generous padding`, `close together`) in the body, or move pixel values to a separate style-keywords line. Never write `Npx` inline where the model could misread it as rendered copy.

## Gemini-specific operational facts

- **No separate negative-prompt field.** Unlike Stable Diffusion, there's no way to pass negatives out-of-band. They go inline in the main prompt. Place them in a single trailing block (exactly as `mockup-prompt` Step 2.5 prescribes).
- **Markdown bolding is ignored, but harmless.** `**No phone. No device frame.**` and `No phone. No device frame.` render identically. Keep the bolding — it's visually obvious to the prompt's human reader without costing anything.
- **Response MIME varies.** Gemini often returns `image/jpeg` even when your prompt implies PNG. The `gemini-toolkit:imagine` script auto-corrects the output path's extension; if you're calling the API directly, inspect `inlineData.mimeType` before writing.

## Escape hatch #1: when the carousel prior won't die

If the sibling-card peek survives two runs with extended negatives + positive framing, don't add a third layer of words. The prior is baked in. **Change the hero-element shape instead:**

- Full-width banner with no card chrome (plain background stripe with the content typed directly on it).
- Tall hero card that occupies ≥40% of the screen height (too tall to read as a carousel tile).
- List-first layout — drop the hero card entirely and lead with the transaction list or content feed.

A restructured layout wins in one run what three rounds of negation can't.

## Escape hatch #2: the reframing tactic (most powerful)

Against the whole iOS-chrome category — notch, Dynamic Island, home indicator, rounded screen corners — the strongest single tactic is **reframing the image's identity, not negating its parts**.

Instead of adding yet another `No notch. No Dynamic Island. No rounded corners.` line, redefine what the model thinks it's drawing:

> This is a design mockup, not a phone screenshot, so no iOS system UI is rendered. The image output is a rectangle with four perfectly sharp 90-degree corners. Every pixel is either UI or the dark background. The top 50 pixels of the canvas are pure empty background — no status bar, no time display, no battery icon, no wifi icon, no Dynamic Island, no notch, no pill shape, no system chrome of any kind.

The reason this works: status-bar-shaped content is the *substrate* the Dynamic Island prior attaches to. When the status bar exists, Gemini tries to make it "authentic" — the Dynamic Island is the authenticity marker. Remove the status bar entirely and the Dynamic Island has nowhere to live.

Observed impact (Ember run, 2026-04-16): v1 → v2 = -7.75 points by adding more negations; v2 → v3 = **+25.5 points by reframing and removing the status bar**. Same scene, same palette, same layout.

Use this escape hatch when:
- The `no_device_chrome` score is <50 and stayed that low for two runs in a row.
- The project brief doesn't require rendering a real status bar (most mockups don't).

If the mockup genuinely needs a time/battery display (marketing materials meant to look like a real phone), accept that the Dynamic Island will probably appear and compose the final asset by cropping or compositing instead of trying to prompt it away.

## Regression signal: when the score goes down, stop adding words

In a multi-run iteration loop, if the **weighted fidelity score regresses** (v(n) lower than v(n-1)), that's not noise — it's a signal that:

1. The added words are fighting an already-activated prior, which strengthens it.
2. The model is reading the growing list of negatives as a *description* of what the image should include, not exclude. (Image models are not language-model-style instruction followers.)

When this happens, stop accumulating text and do one of these:
- **Restructure.** Apply escape hatch #1 (change shape) or #2 (reframe identity).
- **Shorten.** Remove half the negative block and rerun — the condensed version often outperforms the expanded one.
- **Change the scene.** Sometimes the scene itself is the problem (fintech balance card → carousel). Try a genuinely different layout archetype.

Do not keep iterating on the same prompt shape after a regression. Three iterations of the same shape with no convergence means the shape is wrong, not the words.

## Iteration loop with `gemini-toolkit:imagine`

The `gemini-toolkit:imagine` command (from the `gemini-toolkit` plugin) is the fastest way to verify a Gemini prompt. Budget 2–3 runs per screen:

```bash
/gemini-toolkit:imagine --output /tmp/mockup-run1.png <your prompt>
```

Inspect the result against `mockup-prompt` Step 4's defect table, then patch and rerun. Stop after run 3 — if the prompt hasn't converged, apply the escape hatch above or simplify the layout.

## Reference prompt (verified against Gemini 3.1-flash-image-preview)

Concrete example of a prompt that exercises every Gemini-specific guardrail. Good starting template; adapt the scene, keep the structure.

```
A flat, fullscreen mobile UI screenshot, straight-on, 390x844 aspect ratio (phone portrait), no device frame, no background, screen fills canvas edge to edge with square corners.

The entire canvas is a dark navy (#0D1B2A) app background that extends to all four canvas edges.

Status bar at the very top shows "9:41" on the left and small solid white filled signal, wifi, and battery icons on the right.
Header below the status bar reads "Balance" in large white text, with a small circular avatar on the right.
A single glassmorphism card sits below the header. The card stretches full width with 16px margins on both the left and right sides. The space to the left and right of the card is solid #0D1B2A navy background, the same as the rest of the screen — no other cards, no carousel, no content peeking from either edge. The card reads "Total Balance" in small uppercase white text at the top, and "$12,480.50" in bold white below it. Ensure "$12,480.50" is rendered legibly in bold white, exactly as written.
Below the card, two side-by-side pill buttons: the left one has label "Send" in white, the right one has label "Receive" in white.
Below the buttons, a section header reads "Transactions" in white.
Three transaction rows below it. Each row has a small colored circle icon on the left, a short name in white, and a value on the right. Row 1: purple circle, "Spotify", "-$9.99". Row 2: green circle, "Salary", "+$3,200.00". Row 3: orange circle, "Uber", "-$18.40".
A bottom nav pinned to the bottom has four solid white filled icons evenly spaced: home, chart, wallet, profile.

Clean sans-serif typography, glassmorphism cards, 16px rounded corners on UI elements only, soft purple accents, fintech aesthetic, pixel-perfect.

**No phone. No device frame. No bezel. No hardware. No 3D perspective. No tilt. No white background. No gray background. No drop shadow behind the screen. No rounded screen corners — canvas corners are square. No iOS home indicator bar. No notch, no Dynamic Island, no status-bar cutout. No sibling cards or carousel peeking from the edges — the canvas shows exactly one screen. Screenshot only. UI fills the entire canvas.**
```

On the fintech scene above, this prompt produces a clean render with correct text, colors, and layout; the carousel peek typically appears as a thin right-edge sliver (apply the escape hatch if that's unacceptable).

---

## Output Format

Same as `mockup-prompt` — return the prompt in a labeled code block. When correcting an existing output, follow with a diagnostic table, and call out which defects are Gemini-specific priors vs. model-agnostic issues so the user knows which may recur on reruns.
