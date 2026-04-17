---
description: Analyze images, screenshots, and PDFs with Gemini's multimodal API
allowed-tools: Bash, Glob, Read
argument-hint: "<file1> [file2 ...] <task>"
---

# /gemini-toolkit:vision

Send one or more images/PDFs to Gemini along with a task. Good for describing screenshots, summarizing PDFs, comparing diagrams to specs, extracting text from images.

## Usage

```bash
/gemini-toolkit:vision screenshot.png What's wrong with this layout?
/gemini-toolkit:vision spec.pdf diagram.png Does the diagram match the spec?
```

Supported: PNG, JPEG, WEBP, GIF, PDF. Max 20MB per file.

## How to parse `$ARGUMENTS`

Split on whitespace. Anything that looks like a path to an existing file (check with `Read` or glob) is a `<file>`. Everything after the last file is the `<task>`. If no files resolve, stop and ask for clarification.

## How to invoke

Delegate to `gemini-vision`:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/gemini-api.js \
    --mode vision \
    --files <comma-joined file paths> \
    --task "<TASK>"
```

Surface `response` to the user. If `ok: false`, surface `error`.

## Errors

| Symptom | Fix |
| --- | --- |
| `GEMINI_API_KEY is not set` | `export GEMINI_API_KEY=...` |
| `Unsupported file type` | Convert to PNG/JPEG/PDF |
| `File ... is too large` | File exceeds 20MB — compress or split |
| `File not found` | Check the path; relative paths resolve from the user's cwd |
