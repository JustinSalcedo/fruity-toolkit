---
name: project-mockup
description: Generate a UI mockup image that respects the host project's design language, without the user having to spell out every token. Orchestrates four stages — project-context discovery, Gemini-optimized prompt generation (`mockup-prompt-gemini`), image rendering (`/gemini-toolkit:imagine`), and vision-based fidelity scoring (`/gemini-toolkit:vision`) — then iterates prompt revisions until the fidelity score clears a threshold or the Gemini generation budget is exhausted. Use when the user says "make a mockup of the login screen", "render a pricing page for this app", "I need an image of the settings screen", "draft a UI for X", or any request that implies "I want a picture of a screen, shaped to how this codebase already looks." Accepts `budget`, `threshold`, `direction`, and `overrun-policy` controls. For just-the-prompt output (no image), use `mockup-prompt-gemini`. For one-off images with no project context, use `/gemini-toolkit:imagine` directly.
---

# project-mockup

This skill is the high-level, project-aware mockup orchestrator. It chains four already-existing capabilities into one loop so the user can say "mockup the login screen" and get back a rendered image whose colors, fonts, platform, and primitives look like they came from this project — not a generic fintech template.

## Prerequisites

- `/gemini-toolkit:imagine` and `/gemini-toolkit:vision` available (install the `gemini-toolkit` plugin).
- `mockup-prompt-gemini` skill present (lives alongside this skill in `~/.claude/skills/`).
- `GEMINI_API_KEY` exported.

## Inputs (all optional except `screen`)

| Parameter | Default | Purpose |
|---|---|---|
| `screen` | — | Required. The screen to render ("login", "dashboard", "pricing page", etc.). Can be a single phrase or a paragraph. |
| `budget` | `3` | Maximum Gemini image generations per run, including the initial one. |
| `threshold` | `85` | Minimum fidelity score (0–100) required to accept an image. |
| `direction` | — | Free-form hint biasing iteration ("focus on text fidelity", "ignore carousel overflow for this one", "keep dark-mode aesthetic"). |
| `overrun-policy` | `ask` | How to behave when `budget` is hit without clearing `threshold`. One of `ask`, `accept`, `extend=N` (auto-add N more retries, hard cap +5). |
| `output-dir` | project `assets/` or `images/`, else `/tmp/gemini-toolkit` | Where to save the final and intermediate images. |

---

## Workflow

### Step 1 — Discover project UI context

Goal: build a **Project UI Brief** — a compact summary of what the project's UI looks like — by reading authoritative sources. Do NOT ask the user for things the filesystem can tell you.

Check these in parallel (one read each; skip if missing):

**Platform & framework signals:**
- `package.json` dependencies:
  - `react-native`, `expo`, `expo-router` → **mobile (iOS + Android)**
  - `next`, `@remix-run/*`, `astro`, `nuxt`, `@sveltejs/kit` → **web**
  - `vite` + `react`/`vue`/`svelte` → **web**
  - `electron`, `tauri` → **desktop app**
- `app.json`, `app.config.*` (Expo) → mobile confirmation + screen dimensions
- `ios/`, `android/` top-level dirs → native mobile
- `.storybook/main.*` → component library is Storybook-indexable

**Design tokens (primary source of truth — read the first that exists):**
1. `tailwind.config.{ts,js,cjs,mjs}` → `theme.colors`, `theme.fontFamily`, `theme.screens` (breakpoints), `theme.spacing`, `theme.borderRadius`
2. `tokens.{json,ts,js}` or `design-tokens.{json,ts}` at root or in `src/`
3. `theme.{ts,js}` / `src/theme/*.{ts,js}` (styled-components, Chakra, MUI, NativeWind configs)
4. CSS custom properties in `src/styles/globals.css`, `src/app/globals.css`, `app/globals.css`, `styles/*.css` — look for `:root { --color-*, --font-*, --radius-* }`

**Typography:**
- Google Fonts imports in `_app.tsx`, `app/layout.tsx`, `index.html`, `globals.css`
- `next/font` calls with font family names
- Fallback: `theme.fontFamily` from tokens source

**Primitives & components:**
- `src/components/ui/` (shadcn pattern) — list file names to infer primitive vocabulary (button, input, dialog, card…)
- `src/design-system/`, `packages/ui/`
- `.storybook/` stories tell you which components exist and their variants

**Viewports & breakpoints:**
- Tailwind `theme.screens` (`sm`, `md`, `lg`, `xl`, `2xl`)
- CSS `@media` rules in global stylesheets
- Expo `app.json` `orientation` + target devices
- For mobile: default viewport is 390×844 (iPhone 15); for tablet: 834×1194 (iPad); for web desktop: 1440×900; for web mobile: 390×844

**Themes & color schemas:**
- `next-themes`, `useColorScheme`, `prefers-color-scheme` usage → light+dark
- Tailwind `darkMode: 'class'` or `'media'` → dark mode is in play
- Named color scales (primary.50..900, etc.) in tokens

**Design docs (optional, low priority):**
- `docs/design/**/*.md`, `DESIGN.md`, `BRAND.md`, `STYLE_GUIDE.md`, `UI.md`
- `README.md` design/brand section

**Assets:**
- Mobile: `assets/`, `src/assets/`
- Web: `public/`
- Logos: look for `logo.*`, `brand/`, `icon.*`

Produce the Project UI Brief as a structured summary (keep it in scratchpad/tool-output, don't write it to disk unless the user wants it persisted):

```
Platform: <web|mobile|desktop>
Viewports: <e.g. 390x844 mobile portrait; 1440x900 desktop>
Framework: <Next.js 15 / Expo 52 / etc.>
Theme: <light only | light+dark | dark only>
Primary colors: { primary: #..., background: #..., surface: #..., text: #..., accent: #... }
Font families: { sans: "Inter", mono: "JetBrains Mono" }
Type scale: { heading: 24px/32px bold, body: 16px/24px regular }
Border radii: { sm: 4px, md: 8px, lg: 16px }
Primitives available: [Button, Card, Input, Dialog, Badge, ...]
Breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 }
Visible aesthetic keywords: <glassmorphism | brutalist | soft-shadows | etc.>
Assets likely relevant: [logo.svg, hero.png, ...]
Notes: <anything else worth carrying into the prompt>
```

If a category has no authoritative source, mark it `unknown` and handle it in Step 2.

### Step 2 — Resolve the request

Reconcile the user's `screen` with the Project UI Brief.

**If the request is unambiguous** (everything needed is either in the request or in the brief), proceed silently.

**If the request is ambiguous**, ask at most 3 clarifying questions using `AskUserQuestion`, biased toward decisions that change the prompt structure:

1. **Platform** (if brief says unknown and the project is multi-target): "Web, mobile, or both?"
2. **Theme** (if both light+dark exist): "Light mode or dark mode?"
3. **Viewport / breakpoint** (for web specifically): "Mobile (390×844), tablet (834×1194), or desktop (1440×900)?"

Do NOT ask about colors, fonts, or spacing — those come from the brief. Do NOT ask more than 3 questions; if the space is still too open, make a reasonable choice and state it in your response.

If the user passed `direction`, respect it as overriding the brief where they conflict (e.g. `direction: "use yellow instead of the project blue"` wins over the brief's blue).

### Step 3 — Generate the prompt

Invoke the `mockup-prompt-gemini` skill with the screen description plus the resolved Project UI Brief folded in. Pass the brief to the skill as supplementary context; do NOT paste raw Tailwind config into the prompt — translate tokens into the concrete form `mockup-prompt-gemini` expects (hex codes for colors, font family names, aspect ratio for viewport).

Capture the generated prompt text. This is the **v1 prompt**.

### Step 4 — Generate the image (iteration k, k = 1)

Call `/gemini-toolkit:imagine` with the v1 prompt. Save to `<output-dir>/<slug>-v1.png`.

Increment a `generations_used` counter. Default budget is 3, so initial generation counts as one.

### Step 5 — Score fidelity via vision

Invoke `/gemini-toolkit:vision` with the generated image and this scoring task:

```
Evaluate this UI mockup image against the spec below. Score each criterion 0-100 and return JSON only, no prose.

Spec:
<the v1 prompt, or a compressed form>

Criteria:
- text_fidelity (0-100): Are all text strings rendered legibly, correctly spelled, and matching the spec?
- layout_order (0-100): Are UI sections in the correct vertical order per the spec?
- color_fidelity (0-100): Do the rendered colors match the spec hex codes or named palette?
- no_device_chrome (0-100): Is the canvas free of device frame, bezel, home indicator, notch, Dynamic Island, rounded screen corners? (100 = fully clean; 0 = photo of a phone)
- icon_fidelity (0-100): Are icons correct shape, fill style, and color?
- no_carousel_overflow (0-100): Does the canvas show exactly one screen with no sibling cards or content peeking from left/right edges? (100 = clean; 0 = obvious carousel)
- style_coherence (0-100): Does the overall aesthetic match the style keywords in the spec?

Return this exact JSON shape:
{
  "scores": {
    "text_fidelity": <int>,
    "layout_order": <int>,
    "color_fidelity": <int>,
    "no_device_chrome": <int>,
    "icon_fidelity": <int>,
    "no_carousel_overflow": <int>,
    "style_coherence": <int>
  },
  "defects": [<short string per observed defect>],
  "primary_issue": "<single most impactful defect to fix next, or null if score is acceptable>",
  "patch_suggestion": "<specific sentence to add or substitute in the prompt to address primary_issue, or null>"
}
```

Pass `format: json` to `/gemini-toolkit:vision` so the response is parsed. The current default vision model (`gemini-3-flash-preview`) was picked by the benchmark documented in the appendix below. If your account doesn't have access to the preview, fall back with `--model gemini-2.5-flash` — quality drops noticeably (see appendix) but the skill still functions.

### Step 6 — Compute weighted fidelity score

Apply these weights:

| Criterion | Weight |
|---|---|
| `text_fidelity` | 30 |
| `layout_order` | 20 |
| `color_fidelity` | 15 |
| `no_device_chrome` | 15 |
| `icon_fidelity` | 10 |
| `no_carousel_overflow` | 5 |
| `style_coherence` | 5 |

```
fidelity_score = sum(scores[k] * weight[k] / 100 for k in criteria)
```

Range: 0–100.

### Step 7 — Decide: accept, iterate, or overrun

Three cases:

**A) `fidelity_score >= threshold`** — Accept. Return the image with the score breakdown.

**B) `fidelity_score < threshold` AND `generations_used < budget`** — Iterate:
1. Take `patch_suggestion` from the scoring response.
2. If `direction` is set and conflicts, bias toward `direction`.
3. Apply the patch to the current prompt. Rules:
   - If the defect is in the `no_device_chrome`, `no_carousel_overflow`, or `icon_fidelity` category, apply the `mockup-prompt` Step 4 correctives (cross-reference the table there).
   - If the defect is in `text_fidelity`, tighten labels (shorter, quoted, repeated once).
   - If the same defect category has been primary for 2 iterations without improvement (≥5 points gain), apply the `mockup-prompt-gemini` escape hatch: restructure the hero shape.
4. Loop back to Step 4 with the patched prompt and `k = k + 1`.

**C) `fidelity_score < threshold` AND `generations_used >= budget`** — Budget overrun. Apply `overrun-policy`:

| Policy | Behavior |
|---|---|
| `ask` (default) | Issue a budget-overrun warning with the current best score, per-criterion breakdown, and remaining defects. Use `AskUserQuestion` with four options: **accept current best**, **extend budget by 2**, **extend budget by 5 (hard cap)**, **cancel**. |
| `accept` | Return the highest-scoring image from the run, no question. Mark response `overrun: true`. |
| `extend=N` | Auto-extend budget by `N` (capped at +5). Do not ask. |

When extending budget, preserve iteration state — don't restart from v1.

### Step 8 — Output

Always return:
- **Final image path** (the highest-scoring image, even on overrun/cancel).
- **Final fidelity score** (weighted total + per-criterion breakdown).
- **Generations used / budget** (e.g. `3/3`, `5/5 after extend`).
- **Prompt versions** saved alongside the images as `<slug>-v<k>.prompt.txt`.
- **Defect summary** for the final accepted image (may be empty if threshold cleared cleanly).

If multiple iterations happened, also report **which correctives moved the needle** — this helps the user learn the project's model-prior fingerprint over time.

---

## Direction handling

`direction` is applied at two points:
- **Step 3 (initial prompt)** — bias the prompt toward the direction.
- **Step 7.B (iteration)** — bias patch selection. If direction says "focus on text", and the primary defect is `no_carousel_overflow`, still patch the carousel *only if* text is above 90; otherwise prioritize the text issue.

Direction is NOT a hard override of the fidelity scorer — the score is what it is. Direction just changes which defect to fix first when multiple exist.

Post-overrun directions (user-provided on the overrun prompt):
- `"accept"` → behave as policy `accept`.
- `"continue N more"` → extend by N (hard cap +5).
- `"cancel"` → return best image with `cancelled: true` marker.
- `"drop threshold to X and accept the next improvement"` → lower threshold to X, allow one more iteration.
- Free-form direction like `"the hero is too tall, make it a banner"` → apply as a direction hint and extend by 1.

---

## Failure modes and handling

| Situation | Handling |
|---|---|
| `gemini-toolkit:imagine` returns `ok: false` (rate limit, API error) | Retry once with backoff; if still failing, abort the run and surface the error. Do not count the failed call toward `budget`. |
| `gemini-toolkit:vision` returns malformed JSON | Fall back to a manual assessment: inspect the image with Read and assign conservative scores based on what's visible; note in the response that scoring was degraded. |
| No project signals found (bare directory) | Proceed with reasonable defaults: web, light theme, 1440×900, sans-serif stack, blue primary. Explicitly say "inferred defaults — pass `direction` to override." |
| User's `screen` still ambiguous after 3 clarifying questions | Pick the most likely interpretation, state the assumption in the response, proceed. |
| Every iteration regresses the score | After 2 regressions, stop iterating and return the best image with a note that the prompt is likely over-constrained. |

---

## Worked example (for reference when invoking)

User: "Render the dashboard screen."

Claude:
1. Reads `package.json` (finds `next`, `tailwindcss`, `@radix-ui/*`) → web, Next.js, shadcn-style primitives.
2. Reads `tailwind.config.ts` → primary `#2563eb`, background `#ffffff` (light) and `#0a0a0a` (dark), font `Inter`, radii `sm=4, md=8, lg=16`.
3. Reads `src/components/ui/` → `button`, `card`, `input`, `tabs`, `avatar`, `badge` available.
4. Two possible interpretations: light vs dark theme. Asks: "Light or dark?" → user says dark.
5. Invokes `mockup-prompt-gemini` with: "Dashboard screen for a web app. Platform: desktop web 1440×900. Theme: dark (#0a0a0a background). Primary #2563eb. Font Inter. Primitives: Card, Button, Badge, Tabs, Avatar. Show: left sidebar nav, top bar with search and avatar, main area with 4 stat cards in a row and one chart below."
6. Generates image → scores 78.
7. Primary defect: `text_fidelity` 62 — chart labels garbled. Patches: tighten chart labels to 1–2 words, quote them.
8. Regenerates → scores 88. Returns.

---

## Output format

Return a structured report:

```
**Mockup rendered**: /path/to/screen-v3.png
**Fidelity**: 88/100 (threshold 85 ✓)
**Generations**: 3/3 budget used
**Scores**:
  - text_fidelity:        90
  - layout_order:         95
  - color_fidelity:       88
  - no_device_chrome:     82
  - icon_fidelity:        85
  - no_carousel_overflow: 100
  - style_coherence:      85
**Remaining defects** (below threshold): home-indicator faint at the bottom
**What moved the needle**: Tightening chart labels to 1-word quoted strings (text_fidelity +28).
**Prompt**: /path/to/screen-v3.prompt.txt
```

Follow with a short suggestion for manual edits if any defect is still visible and the user cares more than the score does.

---

## Benchmark (2026-04-17)

The Step 5 scoring model was picked empirically. Four vision models were compared on a real mockup (`ember-v3.jpeg`, dark-theme productivity mobile screen) using a two-task protocol — free-form description (30% weight) and structured JSON scoring per the Step 5 rubric (70% weight) — with a blind Opus 4.7 judge.

### Round 1 — four-way

| Rank | Model | Final | Task B latency | Headline |
|---|---|---|---|---|
| 1 | Haiku 4.5 | 92.18 | 12s | Grounded, fast, minimal hallucination |
| 2 | Opus 4.7 | 94.66 (→ tie-broken) | 16s | Tightest accuracy but not worth the cost/latency |
| 3 | Sonnet 4.6 | 81.77 | 21s | Hallucinated rounded corners that leaked into scoring |
| 4 | Gemini 2.5 Flash | 73.68 | 30s | Confabulated full iOS status bar; mis-weighted color |

Opus's raw numeric top-rank was tie-broken away by (a) the self-preference safeguard (judge was also Opus, margin <5 points) and (b) latency.

### Round 2 — rematch with the new Gemini model

Prompted by the gap: swap `gemini-2.5-flash` → `gemini-3-flash-preview`, re-run.

| Rank | Model | Final | Task B latency |
|---|---|---|---|
| 1 | **Gemini 3 Flash** (after tie-break) | 91.03 | 12.86s |
| 2 | Haiku 4.5 | 92.84 | 17s |

Raw margin Haiku +1.81 → inside the 3-point band → latency tie-breaker → Gemini 3 Flash.

Gemini 3 Flash closed an **18-point gap** vs. Gemini 2.5 on Task B alone, fixed both of 2.5's failure modes (chrome confabulation, color nit-picking), and is 2.3× faster. Haiku retains tighter per-criterion calibration but introduced its own hallucinations in round 2 (iOS claim, phantom rounded corners, fabricated decorative dot) — its grounding is less stable than round 1 suggested.

### Decision

Default scorer is **`gemini-3-flash-preview`** via `/gemini-toolkit:vision`. Chosen because:

1. It wins the rematch tie-breaker cleanly.
2. Keeps the plugin's execution path uniform (one vendor, one auth, one pricing model).
3. Haiku-based fallback exists in the Agent tool if the preview model is ever retired; swap `--model gemini-2.5-flash` for the legacy path.

Full report: `/tmp/vision-bench-rematch/bench-report-rematch.md` (transient; see git log / original run for reproduction).

### Caveats

- Gemini 3 Flash scores cluster near 100 — **calibration is looser than Haiku's**. If users report the loop accepting images they consider defective, revisit.
- `-preview` means the model is subject to change. Re-bench when the preview graduates or a new family Flash model lands.
- Single-image benchmark. Not tested on web, light-theme, or non-mobile mockups.
