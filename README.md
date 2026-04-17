# mockup-prompt

A Claude Code plugin that generates guardrail-enforced text prompts for AI image generation models tasked with rendering UI mockups. Suppresses the most common failure modes across GPT Image, Ideogram, FLUX, Midjourney, and Stable Diffusion:

- Device hardware bleeding in when you wanted a clean screenshot
- 3D tilt and perspective warp
- White or gray background bleed outside the UI
- Garbled and hallucinated text inside the UI

The plugin ships a single `mockup-prompt` skill. Claude will surface it when you ask for a mockup prompt or describe a UI defect in an existing prompt.

## Installation

```bash
/plugin marketplace add JustinSalcedo/mockup-prompt
/plugin install mockup-prompt@mockup-prompt
/reload-plugins
```

## Usage

Ask Claude for a prompt:

```
Generate a prompt for a pricing page mockup: three tiers, warm dark theme, my brand green.
```

Or ask it to fix an existing one:

```
The phone frame is showing in my output. Fix this prompt: <paste>
```

Claude will invoke `mockup-prompt` and return a copy-pasteable prompt.

## What's in the skill

- **Step 1** — Clarify output mode (fullscreen screenshot vs. device mockup).
- **Step 2** — Prompt structure: output declaration → color foundation → layout → typography → hard negative block.
- **Step 3** — Text rendering guardrails (quotes, short labels, critical-text repetition).
- **Step 4** — Corrective table: 13 common defects mapped to specific prompt patches.
- **Step 5** — Per-model notes (GPT Image, Ideogram, FLUX, Midjourney, SD, Gemini Image).
- **Step 6** — Verify-and-iterate guidance.

## Companion plugin

For Gemini-specific mockup work (with extended tested guardrails for `gemini-2.5-flash-image` / `gemini-3.1-flash-image-preview`), install [`gemini-toolkit`](https://github.com/JustinSalcedo/gemini-toolkit) — it ships `mockup-prompt-gemini` (Gemini-tested layer on top of this skill) and `project-mockup` (orchestrator with scoring-based iteration).

## License

MIT. See `LICENSE`.
