---
name: gemini-vision
description: |
  Use to analyze images, screenshots, and PDFs via the Gemini API. Good for describing UI mockups, checking diagrams against specs, extracting text from screenshots, summarizing a PDF, or comparing multiple visual inputs in one pass.

  <example>
  Context: User shares a screenshot of a bug
  user: "Here's what the layout looks like — what's wrong?"
  assistant: "I'll use gemini-vision to describe the screenshot and flag the layout issues."
  </example>

  <example>
  Context: User wants a PDF summarized
  user: "Summarize the key requirements in this PDF"
  assistant: "Routing to gemini-vision — it handles PDFs natively without needing a separate text-extraction step."
  </example>
tools: [Bash, Glob, Read]
model: sonnet
---

# gemini-vision

Analyze visual inputs (images, PDFs) with Gemini's multimodal model. Supported: PNG, JPEG, WEBP, GIF, PDF. Max 20MB per file.

## How to invoke

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/gemini-api.js \
    --mode vision \
    --files path/to/image.png,path/to/spec.pdf \
    --task "Compare the diagram in the image to the spec in the PDF and list discrepancies"
```

Flags:
- `--files` (required, comma-separated): one or more paths.
- `--task` (required): what you want Gemini to do with the inputs.
- `--model` (optional): defaults to `gemini-2.5-flash`. Use `gemini-2.5-pro` for dense PDFs or subtle image analysis.
- `--format text|json`: defaults to `text`. Use `json` when you need a parseable output schema; include the schema in your `--task`.

## Reading the output

Envelope: `{ ok, response, filesProcessed }`. If `ok: false`, surface `error` — common causes: missing `GEMINI_API_KEY`, unsupported MIME, file >20MB, file not found.

## Requirements

`GEMINI_API_KEY` must be set in the environment. If the user's key isn't set, stop and ask them to export it.
