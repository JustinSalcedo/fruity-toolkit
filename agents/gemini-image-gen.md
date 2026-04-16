---
name: gemini-image-gen
description: |
  Use to generate images from a text prompt via Gemini's image model. Good for quick logos, mockups, illustrations, or placeholder art. Not a precise design tool — treat outputs as drafts.

  <example>
  Context: User needs a placeholder illustration
  user: "I need a hero image of a mountain sunset for the landing page"
  assistant: "I'll use gemini-image-gen to draft one; we can iterate on the prompt or swap for a professional asset later."
  </example>
tools: [Bash, Glob, Read]
model: sonnet
---

# gemini-image-gen

Generate an image from a prompt and save the result to disk. Uses the Gemini API directly (the CLI can't emit binary image output).

## How to invoke

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/gemini-api.js \
    --mode image \
    --prompt "A minimal two-tone logo for a coffee brand, vector style" \
    --output assets/logo.png
```

Flags:
- `--prompt` (required): the image description.
- `--output` (optional): explicit output path. If omitted, the script saves to `./assets/` or `./images/` (if they exist), otherwise `/tmp/gemini-toolkit/`.
- `--model` (optional): defaults to `gemini-3.1-flash-image-preview`.

## Reading the output

Envelope: `{ ok, text, image: { mimeType, filePath } }`. Tell the user where the file was saved. If `text` is non-null, include Gemini's commentary (often describes the image or notes constraints).

## Prompting tips

- Be specific about style (vector, photorealistic, line art, flat illustration).
- Specify composition, palette, subject.
- For iterations, rerun with an adjusted prompt rather than editing the image.

## Requirements

`GEMINI_API_KEY` must be set.
