---
description: Generate an image from a text prompt via the Gemini API
allowed-tools: Bash, Glob, Read
argument-hint: "[--output path] <prompt>"
---

# /gemini-toolkit:imagine

Generate an image from a prompt. The CLI path can't emit images, so this goes straight to the Gemini REST API.

## Usage

```bash
/gemini-toolkit:imagine <prompt>
/gemini-toolkit:imagine --output assets/hero.png A cinematic mountain sunset
```

## How to parse `$ARGUMENTS`

Extract `--output <path>` if present; everything else is the `<prompt>`.

## How to invoke

Delegate to `gemini-image-gen`:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/gemini-api.js \
    --mode image \
    --prompt "<PROMPT>" \
    [--output <OUTPUT>]
```

If no `--output`, the script picks `./assets/` or `./images/` (if present), else `/tmp/gemini-toolkit/`. Tell the user where the file was saved (`image.filePath` in the result).

## Errors

| Symptom | Fix |
| --- | --- |
| `GEMINI_API_KEY is not set` | `export GEMINI_API_KEY=...` |
| `did not include inlineData` | Model refused or returned text-only; retry with a clearer prompt |
| `rate limited (429)` | Wait and retry |
