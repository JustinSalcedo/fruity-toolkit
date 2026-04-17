---
description: Long-context code analysis via Gemini CLI — architecture, refactor impact, cross-file audits
allowed-tools: Bash, Glob, Read
argument-hint: "[--model name] [--dirs path,...] <task>"
---

# /gemini-toolkit:analyze

Route a broad analysis task to Gemini. Good for architecture maps, refactor impact analysis, security sweeps, pattern audits — anything that benefits from reading many files at once.

## Usage

```bash
/gemini-toolkit:analyze <task>
/gemini-toolkit:analyze --model <name> <task>
/gemini-toolkit:analyze --dirs <path,...> <task>
/gemini-toolkit:analyze --model gemini-3-pro --dirs apps/api,packages/auth Review the auth flow for gaps
```

## How to parse `$ARGUMENTS`

Extract optional flags in order: `--model <name>`, `--dirs <comma-separated>`. Everything remaining is the `<task>` (may contain spaces and quotes; preserve verbatim).

## How to invoke

Delegate to the `gemini-analyst` agent. Pass the parsed arguments to `scripts/gemini-dispatch.js` via Bash:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/gemini-dispatch.js \
    --task "<TASK>" \
    [--model <MODEL>] \
    [--dirs <DIRS>] \
    --format json
```

Surface the script's `response` field to the user. If `ok: false`, surface `error`. Include `stats` (token counts) only if the user asked or the numbers matter for cost awareness.

## Examples

| Ask | Call |
| --- | --- |
| `/gemini-toolkit:analyze Summarize the testing strategy` | dispatch with `--task "Summarize the testing strategy"` |
| `/gemini-toolkit:analyze --dirs apps/web Explain the routing layer` | dispatch with `--dirs apps/web --task "Explain the routing layer"` |
| `/gemini-toolkit:analyze --model gemini-3-pro --dirs src/auth Audit for timing attacks` | dispatch with all three |

## Errors

| Symptom | Fix |
| --- | --- |
| `Gemini CLI not on PATH` | `npm i -g @google/gemini-cli` |
| `exited with code` + quota message | Wait or switch `--model` |
| Timeout | Narrow `--dirs` scope or break the task into smaller passes |
