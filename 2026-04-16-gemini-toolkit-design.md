# gemini-toolkit — Design Spec

**Date:** 2026-04-16
**Author:** Justin Salcedo + Claude
**Status:** Approved
**Repo:** `JustinSalcedo/gemini-toolkit` (GitHub, public)
**Scope:** User-scope Claude Code plugin, published as a one-plugin marketplace

---

## 1. Purpose

A Claude Code plugin that integrates Google's Gemini CLI and Gemini API to provide four capabilities:

1. **Long-context code analysis** via Gemini CLI (replaces cc-gemini-plugin)
2. **Image generation** via direct Gemini API (bypasses CLI's text-only output limitation)
3. **Multimodal input analysis** via direct Gemini API (images, screenshots, PDFs)
4. **Skill synchronization** — translates Claude Code skills into Gemini-native skills

## 2. Architectural Approach

**Node.js Core (Approach B):** Four Node.js scripts handle all logic. Commands and agents are Markdown definitions that invoke these scripts via Bash. No external npm dependencies — uses Node 22 builtins only (`fetch`, `fs/promises`, `child_process`, `parseArgs`). ES modules throughout.

**Why not the alternatives:**

- Shell-only (Approach A): Can't reliably parse JSON, assemble multipart API calls, or parse Markdown frontmatter.
- Gemini Extension (Approach C): Undocumented, fast-moving extension API. Too risky for a stable plugin.

## 3. Repository Structure

```
gemini-toolkit/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── agents/
│   ├── gemini-analyst.md
│   ├── gemini-vision.md
│   ├── gemini-image-gen.md
│   └── gemini-skill-sync.md
├── commands/
│   ├── analyze.md
│   ├── vision.md
│   ├── imagine.md
│   └── skill-sync.md
├── scripts/
│   ├── gemini-dispatch.js
│   ├── gemini-api.js
│   ├── gemini-skill-sync.js
│   └── utils.js
├── templates/
│   └── gemini-skill-scaffold.md
├── tests/
│   ├── fixtures/
│   │   ├── sample-skill.md
│   │   ├── api-image-response.json
│   │   ├── api-vision-response.json
│   │   └── cli-json-response.json
│   ├── gemini-dispatch.test.js
│   ├── gemini-api.test.js
│   └── gemini-skill-sync.test.js
├── SKILL.md
├── package.json
├── README.md
├── LICENSE
└── .gitignore
```

## 4. Scripts

### 4.1 `gemini-dispatch.js` — CLI Wrapper

Wraps the Gemini CLI for headless analysis tasks. Lets Gemini use its own native tools (read_file, grep_search, glob) instead of pre-collecting files client-side.

**Input:**

```json
{
  "task": "string (required)",
  "model": "string (default: 'auto')",
  "dirs": ["string[] — extra workspace dirs"],
  "format": "'text' | 'json' (default: 'json')",
  "yolo": "boolean (default: true)",
  "timeout": "number ms (default: 120000)"
}
```

**Execution:** Async `spawn` of `gemini -p "<task>" -m <model> --include-directories <dirs> -y --output-format json`

**Output:**

```json
{
  "ok": true,
  "response": "Gemini's text answer",
  "model": "gemini-3-flash-preview",
  "stats": {"input": 8500, "output": 30, "cached": 8133, "tool_calls": 0},
  "error": null
}
```

### 4.2 `gemini-api.js` — Direct Gemini API

Two functions: `generateImage()` and `analyzeVision()`.

#### `generateImage()`

**Input:**

```json
{
  "prompt": "string (required)",
  "model": "string (default: 'gemini-3.1-flash-image-preview')",
  "outputPath": "string | null (Claude decides)"
}
```

**Execution:** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with `responseModalities: ["TEXT", "IMAGE"]`.

**Output:**

```json
{
  "ok": true,
  "text": "optional model commentary",
  "image": {
    "mimeType": "image/png",
    "filePath": "/path/where/saved.png"
  }
}
```

**Output path resolution:** If `outputPath` is null, `resolveOutputPath()` from utils.js picks a location:

- Project has `assets/` or `images/` dir → save there
- Otherwise → `/tmp/gemini-toolkit/<timestamp>-<hash>.png`

#### `analyzeVision()`

**Input:**

```json
{
  "task": "string (required)",
  "files": ["path1.png", "path2.pdf"],
  "model": "string (default: 'gemini-2.5-flash')",
  "format": "'text' | 'json' (default: 'text')"
}
```

**Execution:** Same API endpoint. Files are read from disk, base64-encoded, and sent as `inlineData` parts.

**Output:**

```json
{
  "ok": true,
  "response": "Gemini's analysis",
  "filesProcessed": ["path1.png", "path2.pdf"]
}
```

**Constraints:** Max 20MB per file. Supported MIME types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`.

### 4.3 `gemini-skill-sync.js` — Skill Translator

Translates Claude Code skill Markdown (with YAML frontmatter) into Gemini CLI skill format.

**Input:**

```json
{
  "skillPath": "string (path to Claude skill .md)",
  "install": "boolean (default: false)"
}
```

**Process:**

1. Read the Claude skill `.md` file
2. Parse YAML frontmatter (`name`, `description`, triggers)
3. Extract instruction body
4. Map Claude tools to Gemini equivalents:
   - `Read` → `read_file`
   - `Grep` → `grep_search`
   - `Glob` → `glob`
   - `Bash` → `run_shell_command`
   - `Edit` → `replace`
   - `Write` → `write_file`
   - `WebSearch` → `google_web_search`
   - `WebFetch` → `web_fetch`
   - Others → skipped with warning
5. Fill `templates/gemini-skill-scaffold.md` with translated content
6. Write to `~/.gemini/skills/synced/<skill-name>.md`
7. Optionally run `gemini skills link <path>`

**Output:**

```json
{
  "ok": true,
  "geminiSkillPath": "~/.gemini/skills/synced/spec-check.md",
  "installed": true,
  "warnings": ["Tool 'LSP' has no Gemini equivalent — skipped"]
}
```

### 4.4 `utils.js` — Shared Utilities

- `parseCliArgs(argv)` — parse `--key value` pairs
- `detectMimeType(filePath)` — extension-based MIME lookup
- `readFileAsBase64(filePath)` — read + encode for API
- `formatError(error)` — consistent `{ ok: false, error: message }` envelope
- `resolveOutputPath(cwd, mimeType)` — context-aware output directory selection

## 5. Agents

Four Claude Code agents, each with tools: `Bash`, `Glob`, `Read`.

| Agent               | Purpose                         | Default Model                    | Script                      |
| ------------------- | ------------------------------- | -------------------------------- | --------------------------- |
| `gemini-analyst`    | Long-context code analysis      | `auto`                           | `gemini-dispatch.js`        |
| `gemini-vision`     | Multimodal input analysis       | `gemini-2.5-flash`               | `gemini-api.js` (vision)    |
| `gemini-image-gen`  | Image generation                | `gemini-3.1-flash-image-preview` | `gemini-api.js` (image gen) |
| `gemini-skill-sync` | Claude→Gemini skill translation | N/A                              | `gemini-skill-sync.js`      |

## 6. Commands

| Command                      | Syntax                            | Agent               |
| ---------------------------- | --------------------------------- | ------------------- |
| `/gemini-toolkit:analyze`    | `[--model X] [--dirs a,b] <task>` | `gemini-analyst`    |
| `/gemini-toolkit:vision`     | `<file1> [file2...] <task>`       | `gemini-vision`     |
| `/gemini-toolkit:imagine`    | `[--output path] <prompt>`        | `gemini-image-gen`  |
| `/gemini-toolkit:skill-sync` | `[skill-name\|skill-path]`        | `gemini-skill-sync` |

## 7. Error Handling

All scripts return `{ ok: boolean, ..., error?: string }`. No silent failures.

| Category    | Errors Handled                                                                   |
| ----------- | -------------------------------------------------------------------------------- |
| Environment | `gemini` not on PATH, `GEMINI_API_KEY` not set                                   |
| Network     | HTTP 429 (rate limit), HTTP 400 (bad request), timeout                           |
| File I/O    | Input file not found, unsupported MIME type, file >20MB, write permission denied |
| Translation | Missing frontmatter, unmappable tools (lossy — warning, not error)               |
| CLI         | Non-zero exit, malformed JSON output (fallback to raw text)                      |

## 8. Testing

Jest unit tests with no network calls. Three test files, one per script.

**Mocking:**

- `gemini-dispatch.test.js` — mocks `child_process.spawn`
- `gemini-api.test.js` — mocks `global.fetch`
- `gemini-skill-sync.test.js` — reads fixture files from `tests/fixtures/`

**Fixtures:** Captured real responses from Gemini CLI and API stored as JSON/Markdown in `tests/fixtures/`.

No integration tests in v1. Manual testing is sufficient for non-deterministic Gemini outputs.

## 9. Marketplace & Publishing

### GitHub repo

`JustinSalcedo/gemini-toolkit` — public repo. The repo itself is the marketplace.

### Installation

```bash
/plugin marketplace add JustinSalcedo/gemini-toolkit
/plugin install gemini-toolkit@gemini-toolkit
/reload-plugins
```

### Prerequisites

| Dependency         | Required for        | Install                       |
| ------------------ | ------------------- | ----------------------------- |
| Gemini CLI >= 0.38 | analyze, skill-sync | `npm i -g @google/gemini-cli` |
| `GEMINI_API_KEY`   | imagine, vision     | `export GEMINI_API_KEY=...`   |
| Node >= 22         | All scripts         | Required by Claude Code       |

### Versioning

`plugin.json`, `marketplace.json`, and `package.json` carry the version. Bump all three on release.

## 10. Deferred to v2

- **Audio/video generation** (Lyria/Veo) via MCP server or API
- **Streaming output** for long-running analysis tasks
- **Integration tests** against live Gemini
- **Release script** to sync version across plugin.json, marketplace.json, package.json
