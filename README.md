# gemini-toolkit

A Claude Code plugin that wires Google's Gemini CLI and Gemini API into four focused capabilities:

| Command                      | What it does                                    | Backed by                                  |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------ |
| `/gemini-toolkit:analyze`    | Long-context code analysis (1M-token window)    | Gemini CLI via `scripts/gemini-dispatch.js` |
| `/gemini-toolkit:vision`     | Analyze images, screenshots, and PDFs           | Gemini API via `scripts/gemini-api.js`      |
| `/gemini-toolkit:imagine`    | Generate images from a prompt                   | Gemini API via `scripts/gemini-api.js`      |
| `/gemini-toolkit:skill-sync` | Translate a Claude Code skill into Gemini skill | `scripts/gemini-skill-sync.js`              |

## Installation

```bash
/plugin marketplace add JustinSalcedo/gemini-toolkit
/plugin install gemini-toolkit@gemini-toolkit
/reload-plugins
```

## Prerequisites

| Dependency         | Required for           | Install                       |
| ------------------ | ---------------------- | ----------------------------- |
| Gemini CLI >= 0.38 | `analyze`, `skill-sync` | `npm i -g @google/gemini-cli` |
| `GEMINI_API_KEY`   | `imagine`, `vision`    | `export GEMINI_API_KEY=...`   |
| Node >= 22         | All scripts            | Shipped with Claude Code      |

## Usage

### analyze — long-context code analysis

```bash
/gemini-toolkit:analyze Map the authentication flow across apps/api and packages/auth
/gemini-toolkit:analyze --model gemini-3-pro --dirs apps/api,packages/auth Review for security gaps
```

Gemini reads files itself via `--include-directories`; there's no client-side pre-collection.

### vision — multimodal input analysis

```bash
/gemini-toolkit:vision screenshot.png What's wrong with this layout?
/gemini-toolkit:vision spec.pdf diagram.png Summarize the spec and check the diagram matches
```

Files ≤20MB each. Supported: PNG, JPEG, WEBP, GIF, PDF.

### imagine — image generation

```bash
/gemini-toolkit:imagine A minimal logo for a coffee brand, two-tone, vector style
/gemini-toolkit:imagine --output assets/hero.png Cinematic sunset over a mountain range
```

If `--output` is omitted, images land in `./assets/` or `./images/` (if they exist), or `/tmp/gemini-toolkit/`.

### skill-sync — translate a Claude skill into a Gemini skill

```bash
/gemini-toolkit:skill-sync path/to/my-skill/SKILL.md
/gemini-toolkit:skill-sync my-skill-name
```

Writes `~/.gemini/skills/synced/<name>/SKILL.md` and, if `--install` is passed, runs `gemini skills link` to activate it.

## Manual test plan

Unit tests run hermetically with `npm test`. End-to-end checks require real Gemini access:

1. `npm test` — all `node:test` suites green.
2. `node scripts/gemini-dispatch.js --task "List files in scripts/" --format json` — returns `ok: true` with a plausible response.
3. `node scripts/gemini-api.js --mode vision --files /tmp/test.png --task "Describe this image"` — returns `ok: true`.
4. `node scripts/gemini-api.js --mode image --prompt "a red circle"` — writes a PNG; `file <path>` reports PNG.
5. `node scripts/gemini-skill-sync.js --skillPath tests/fixtures/sample-skill.md` — creates `~/.gemini/skills/synced/<name>/SKILL.md`. Then `gemini skills link <dir>` and `gemini skills list` surfaces it.

## License

MIT. See `LICENSE`.
