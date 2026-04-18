---
name: project-wireframe
description: Generate a UI **wireframe** image shaped by the host project's information architecture — not its visual design. Orchestrates four stages — project IA discovery, Gemini-optimized wireframe prompt generation (`wireframe-prompt-gemini`), image rendering (`/gemini-toolkit:imagine`), and vision-based fidelity scoring (`/gemini-toolkit:vision`) — then iterates prompt revisions until the wireframe fidelity score clears a threshold or the Gemini generation budget is exhausted. Use when the user says "wireframe the home screen", "sketch a login page for this app", "draft a lo-fi of the settings screen", "I need a wireframe of X", or any request that implies "I want a low-fidelity, grayscale, structural render shaped by what this codebase is". Accepts `budget`, `threshold`, `direction`, `fidelity`, and `overrun-policy` controls. For just-the-prompt output (no image), use `wireframe-prompt-gemini`. For a finished-looking mockup (color, typography, polish) rather than a wireframe, use `project-mockup`.
---

# project-wireframe

This skill is the high-level, project-aware wireframe orchestrator. It chains four capabilities into one loop so the user can say "wireframe the home screen" and get back a lo-fi grayscale image whose structure — platform, viewport, primitives, list density, icon slots — reflects the project as it actually exists, without the user having to restate IA facts the filesystem already knows.

Sibling skill to `project-mockup`. Where `project-mockup` cares about color, font, and visual polish, `project-wireframe` deliberately suppresses all of them. The output is a structural diagram, not a finished design.

## Prerequisites

- `/gemini-toolkit:imagine` and `/gemini-toolkit:vision` available (install the `gemini-toolkit` plugin).
- `wireframe-prompt-gemini` skill present (lives in `gemini-toolkit/skills/`).
- `wireframe-prompt` skill available (universal companion, under `mockup-prompt/skills/`) — `wireframe-prompt-gemini` references it for the base structure.
- `GEMINI_API_KEY` exported.

## Inputs (all optional except `screen`)

| Parameter | Default | Purpose |
|---|---|---|
| `screen` | — | Required. The screen to render ("home", "login", "settings", "time player home"). |
| `budget` | `2` | Maximum Gemini image generations per run, including the initial one. Wireframes converge faster than mockups; default is lower than `project-mockup`'s 3. |
| `threshold` | `80` | Minimum weighted fidelity score (0–100) required to accept an image. Matches the `wireframe-prompt-gemini` rubric acceptance. |
| `fidelity` | `lo-fi` | Wireframe fidelity level: `sketch` (hand-drawn), `lo-fi` (Balsamiq-style), `mid-fi` (cleaner lines, real short copy). |
| `direction` | — | Free-form hint biasing iteration ("focus on text fidelity", "synthesize like A + B + C", "skip tab bar"). |
| `overrun-policy` | `ask` | Behavior when `budget` is hit without clearing `threshold`: `ask`, `accept`, `extend=N` (hard cap +5). |
| `output-dir` | project `assets/`/`images/`, else `/tmp/gemini-toolkit` | Where to save final and intermediate images. |

---

## Workflow

### Step 1 — Discover project IA context

Goal: build a **Project IA Brief** — a compact summary of what the project *is structurally* — by reading authoritative sources. Do NOT ask the user for facts the filesystem reveals. Unlike `project-mockup`'s UI Brief, the IA Brief **does not carry colors, fonts, or radii**; those do not drive a wireframe.

Check these in parallel (one read each; skip if missing):

**Platform & framework signals** (same as `project-mockup`):
- `package.json` dependencies: `react-native` / `expo` → **mobile**; `next` / `astro` / `nuxt` / `vite+react` → **web**; `electron` / `tauri` → **desktop**.
- `app.json`, `app.config.*` (Expo) → mobile confirmation + screen dimensions.
- `ios/`, `android/` dirs → native mobile.

**Screen inventory** (the key IA signal — drives suggested screens and multi-screen context):
- Expo Router: `app/**/*.tsx` route files, `_layout.tsx` tab/stack configs.
- Next.js App Router: `app/**/page.tsx`, `app/**/layout.tsx`.
- Next.js Pages Router: `pages/**/*.tsx`.
- React Navigation: `createBottomTabNavigator`, `createStackNavigator` call sites → tab count, screen names.
- Remix / SvelteKit / Nuxt: route file conventions per framework.
- Storybook stories: `**/*.stories.{ts,tsx}` — lists components but also surfaces screen-level compositions.

**Primitive vocabulary** (placeholders get labeled with primitive names the project already uses):
- `src/components/ui/` (shadcn) → list file names: `button`, `card`, `input`, `dialog`, `tabs`, `avatar`, `badge`, etc.
- `src/components/`, `packages/ui/src/` (generic) → same treatment.
- Native: `src/components/` + any `Themed*` / `Styled*` base components.

**Iconography count and library** (populates tab bars and inline icon slots at the right density):
- `@expo/vector-icons`, `lucide-react`, `react-icons`, `@heroicons/react` usage. Grep import sites to estimate icon density (2–5 per screen is typical).
- Tab bar icon count: read the navigator config's tab definitions.

**Viewports**:
- Mobile default: 390×844 (iPhone 15 portrait). Tablet: 834×1194. Web desktop: 1440×900. Web mobile: 390×844.
- Tailwind `theme.screens` for web breakpoints (desktop only if the target is web).

**Density hints** (list-heavy vs. card-heavy — affects how the wireframe describes row/card repetition):
- Presence of virtualized-list libs (`@shopify/flash-list`, `react-window`) → list-heavy.
- Card-grid primitives (`CardGrid`, `<Grid>` with many `<Card>` children in stories) → card-heavy.
- Dashboard frameworks (`recharts`, `victory-native`, `@tanstack/react-table`) → dashboard density (stat cards + chart + table).

**IA docs** (optional):
- `SPEC.md`, `docs/architecture/**`, `README.md` screen descriptions.

Produce the Project IA Brief (keep in scratchpad; do not write to disk unless the user asks):

```
Platform: <web|mobile|desktop>
Viewport: <390x844 portrait | 1440x900 | ...>
Framework: <Expo 52 / Next.js 15 / ...>
Screen inventory: [home, profile, settings, search, detail, ...]
Tab bar: { count: <n>, names: [home, search, library, profile] }   # null if none
Primitive vocab: [Card, Button, Input, TabBar, ListRow, Avatar, Badge, ...]
Density: <list-heavy | card-heavy | dashboard | mixed>
Icon library: <lucide | @expo/vector-icons | none>
Icons per screen (typical): <n>
Screen-specific IA doc hits: [SPEC.md#home, README.md:design]
Notes: <anything else worth carrying into the prompt>
```

If a category has no authoritative source, mark `unknown` and handle in Step 2.

### Step 2 — Resolve the request

Reconcile `screen` with the IA Brief.

**Reference synthesis clause.** If `direction` names multiple references ("like A + B + C", "synthesize X and Y"), extract **one distinguishing structural element per reference** and enumerate them explicitly in the invocation to `wireframe-prompt-gemini`. Example: `"synthesize grape-heart-core-home + music player + Ember"` →
- from grape-heart-core-home: the three-button circular transport row.
- from music player: prev/play/next semantics on that row.
- from Ember: greeting header + large circular progress ring + today-list with left-side stripe + mood row + tab bar.

List the extracted elements in the prompt-craft call. Do **not** paste reference images themselves — the prompt craft is text-only and Gemini's image-image transfer would reintroduce color/polish priors, defeating the wireframe objective.

**If the request is unambiguous** (platform + viewport + one screen identity), proceed silently.

**If ambiguous**, ask at most 3 clarifying questions via `AskUserQuestion`, biased to decisions that change prompt structure:

1. **Platform** (if brief says unknown and project is multi-target).
2. **Viewport / breakpoint** (for web only): mobile (390×844), tablet (834×1194), or desktop (1440×900)?
3. **Fidelity level** (if not passed): sketch / **lo-fi** (default) / mid-fi?

Do NOT ask about theme — wireframes are grayscale, so theme is N/A. Do NOT ask about colors, fonts, radii. Do NOT exceed 3 questions.

`direction`, when set, overrides the brief where they conflict.

### Step 3 — Generate the prompt

Invoke `wireframe-prompt-gemini` with:
- The screen description (expanded with any reference-synthesis elements from Step 2).
- The IA Brief folded in: platform, viewport, primitive vocabulary, icon count (for tab bars), density hint.
- The fidelity level.

Capture the generated prompt text — this is the **v1 prompt**.

Do **not** pass any numeric-unit values (`"60%"`, `"16px"`) inside the layout description — `wireframe-prompt-gemini` documents this prior explicitly. Widths are qualitative (`wide`, `medium`, `short`).

### Step 4 — Generate the image (iteration k, k = 1)

Call `/gemini-toolkit:imagine` with the v1 prompt. Save to `<output-dir>/<slug>-v1.png` alongside `<slug>-v1.prompt.txt`.

Increment a `generations_used` counter. Default budget is 2 — the initial generation counts as one.

### Step 5 — Score fidelity via vision

Invoke `/gemini-toolkit:vision` with the generated image and the **wireframe rubric** scoring task:

```
Evaluate this UI wireframe image against the spec below. Score each criterion 0-100 and return JSON only, no prose.

Spec:
<the vk prompt, or a compressed form>

Criteria:
- grayscale_purity (0-100): Zero non-gray pixels. Any tinted hue → score drops.
- layout_order (0-100): Sections match the top-to-bottom reading-order spec.
- placeholder_conventions (0-100): X-crossed image placeholders, stacked gray bars for body copy, plain circles for avatars, single-stroke outline icons — used consistently.
- text_fidelity (0-100): Short labels render legibly and match the spec; no numeric-unit leaks ("60%", "16px").
- structural_clarity (0-100): Hierarchy and grouping communicate the IA at a glance.
- no_device_chrome (0-100): No phone frame, bezel, home indicator, notch, Dynamic Island, rounded screen corners. 100 = fully clean canvas.
- no_polish (0-100): No shadows, gradients, realistic imagery, brand colors, detailed icons. 100 = pure wireframe.

Return this exact JSON shape:
{
  "scores": {
    "grayscale_purity": <int>,
    "layout_order": <int>,
    "placeholder_conventions": <int>,
    "text_fidelity": <int>,
    "structural_clarity": <int>,
    "no_device_chrome": <int>,
    "no_polish": <int>
  },
  "defects": [<short string per observed defect>],
  "primary_issue": "<single most impactful defect to fix next, or null if score is acceptable>",
  "patch_suggestion": "<specific sentence to add or substitute in the prompt to address primary_issue, or null>"
}
```

Pass `format: json` to `/gemini-toolkit:vision`. Default scorer: **`gemini-3-flash-preview`** (same as `project-mockup`'s benchmark-picked default). Fallback: `--model gemini-2.5-flash`.

Save the scoring JSON to `<output-dir>/<slug>-v<k>.scores.json`.

### Step 6 — Compute weighted fidelity score

Wireframe-specific weights:

| Criterion | Weight |
|---|---|
| `grayscale_purity` | 20 |
| `layout_order` | 20 |
| `placeholder_conventions` | 20 |
| `text_fidelity` | 15 |
| `structural_clarity` | 10 |
| `no_device_chrome` | 10 |
| `no_polish` | 5 |

```
fidelity_score = sum(scores[k] * weight[k] / 100 for k in criteria)
```

### Step 7 — Decide: accept, iterate, or overrun

**A) `fidelity_score >= threshold`** — Accept. Return image with score breakdown.

**B) `fidelity_score < threshold` AND `generations_used < budget`** — Iterate:
1. Take `patch_suggestion` from scoring response.
2. If `direction` conflicts, bias toward `direction`.
3. Apply the patch. Orchestrator-specific rules:
   - `grayscale_purity` low → apply `wireframe-prompt-gemini`'s escape-hatch reframing ("this is an architect's drafting in black pen on white paper...").
   - `placeholder_conventions` low → tighten Step 2.4 conventions block from `wireframe-prompt`; duplicate row layouts verbatim rather than back-referencing (`wireframe-prompt-gemini` section-name inference prior).
   - `text_fidelity` low with numeric-unit leak → rewrite widths qualitatively (`wide`/`medium`/`short`) and add the explicit negative "No numeric width or size specifications rendered as text".
   - `no_device_chrome` low → extend the negative block with specific chrome items that leaked (home indicator, rounded screen corners).
   - `no_polish` low → apply the escape-hatch reframing as above.
   - If the same defect category has been primary for 2 iterations without ≥5-point improvement, apply the **regression-signal rule** from `wireframe-prompt-gemini`: stop adding words, instead restructure (remove sections), shorten (halve the negative block), reframe (escape hatch), or drop fidelity (lo-fi → sketch).
4. Loop back to Step 4 with `k = k + 1`.

**C) `fidelity_score < threshold` AND `generations_used >= budget`** — Overrun. Apply `overrun-policy`:

| Policy | Behavior |
|---|---|
| `ask` (default) | Issue a budget-overrun warning with current best score + per-criterion breakdown + remaining defects. Ask via `AskUserQuestion`: accept current best / extend by 2 / extend by 5 (hard cap) / cancel. |
| `accept` | Return highest-scoring image, no question. Mark `overrun: true`. |
| `extend=N` | Auto-extend by `N` (cap +5). Do not ask. |

Preserve iteration state on extension.

### Step 8 — Output

Always return:
- **Final image path** (highest-scoring image, even on overrun/cancel).
- **Final fidelity score** (weighted total + per-criterion breakdown).
- **Generations used / budget**.
- **Prompt versions** saved as `<slug>-v<k>.prompt.txt`.
- **Defect summary** for the final accepted image.
- **What moved the needle** across iterations — name the patch types that gained score. Feeds back into the user's growing understanding of the project's Gemini-prior fingerprint.

---

## Direction handling

`direction` applies at two points:
- **Step 3** — bias the initial prompt.
- **Step 7.B** — bias patch selection when multiple defects exist (same rule as `project-mockup`).

Post-overrun free-form directions follow `project-mockup`'s rules (`accept`, `continue N more`, `cancel`, `drop threshold to X`, or free-form hints that extend by 1).

---

## Failure modes and handling

Same as `project-mockup`, with two wireframe-specific additions:

| Situation | Handling |
|---|---|
| Output drifts toward finished-design territory (polish creeping back) | Apply escape-hatch reframing: "architect's drafting in black pen on white paper." Single application typically clears the color/polish prior. |
| `patch_suggestion` is null but score is below threshold | Use the highest-impact low-scoring criterion and apply the matching orchestrator rule from Step 7.B. |
| No project signals found (bare directory) | Default: web, 1440×900, lo-fi, no tab bar. State assumption; user can override with `direction`. |

---

## Worked example (verified 2026-04-17, weighted score 97/100, single generation)

User: "Wireframe the minimalistic time-player home screen. Synthesize grape-heart-core-home's span timer + a music player's transport + Ember's minimalist productivity layout."

Claude:
1. Reads the project. Finds React Native, mobile, 390×844. Tab bar: 3 icons. Primitives: `Card`, `ListRow`, `IconButton`. Density: mixed.
2. Applies **Reference Synthesis clause** — extracts one distinguishing element per reference:
   - from grape-heart-core-home → three-button circular outline transport row.
   - from music player → prev-skip / play-triangle / next-skip glyph semantics on that row.
   - from Ember → top-left date + "Good morning" header; large circular progress ring hero with stacked bars inside; "Today" list with a thin left-edge stripe on each row; centered mood row ("How is today feeling?" + three small circles); three-tab bottom bar with the active tab underlined.
3. Invokes `wireframe-prompt-gemini` with the synthesized structure + IA Brief (mobile, 390×844, 3-tab) + lo-fi fidelity. Qualitative widths only; adds the standard numeric-leak negative plus the screen-specific `"no \"45 of 90\""` to preempt Ember's readout-text leak.
4. Renders → `img/time-player/v1.png`. Scored **97/100**:
   - grayscale_purity 90, layout_order 100, placeholder_conventions 100, text_fidelity 100, structural_clarity 100, no_device_chrome 100, no_polish 80.
   - Sub-100 scores traced to JPEG-compression artifacts (warm tint, texture) and a single spec drift (active tab rendered as thick bar, not thin underline).
5. Accepts v1. No iteration needed.

**What moved the needle** (single-gen convergence):
- Reference Synthesis clause produced the composite shape without iteration — enumeration beats fusion.
- Qualitative widths everywhere (`wide`, `medium`, `short`) kept text_fidelity at 100.
- Screen-specific negative (`no "45 of 90"`) preempted the Ember-readout leak that would otherwise have cost points on `text_fidelity` per the `wireframe-prompt-gemini` numeric-unit prior.

---

## Output format

```
**Wireframe rendered**: /path/to/screen-v1.png
**Fidelity**: 97/100 (threshold 80 ✓)
**Generations**: 1/2 budget used
**Scores**:
  - grayscale_purity:        90
  - layout_order:            100
  - placeholder_conventions: 100
  - text_fidelity:           100
  - structural_clarity:      100
  - no_device_chrome:        100
  - no_polish:               80
**Remaining defects**: minor tint/texture (JPEG artifact); active tab indicator thicker than spec.
**What moved the needle**: Reference Synthesis produced the composite shape in one generation; qualitative widths + screen-specific numeric-leak negative held text_fidelity at 100.
**Prompt**: /path/to/screen-v1.prompt.txt
```

Follow with a short suggestion for a rerun if a Gemini-prior defect (home indicator, rounded corners) still cost meaningful points.

---

## Notes

- Default scorer is `gemini-3-flash-preview` — same as `project-mockup`. The benchmark there applies here too; the wireframe rubric has not been separately benchmarked, but structural scoring is less color-sensitive than mockup scoring, so the same model choice holds.
- Wireframe threshold default (80) is lower than mockup threshold (85) because the wireframe rubric penalizes fewer polish dimensions (no `color_fidelity`, no `style_coherence`) and `no_device_chrome` is a known-flickery Gemini prior that costs ~10 points on any given run.
