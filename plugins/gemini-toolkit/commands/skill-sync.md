---
description: Translate a Claude Code skill into a Gemini-native skill and optionally install it
allowed-tools: Bash, Glob, Read
argument-hint: "[--install] <skill-name|skill-path>"
---

# /gemini-toolkit:skill-sync

Translate a Claude skill's frontmatter + body into the Gemini skill format. Writes to `~/.gemini/skills/synced/<name>/SKILL.md`.

## Usage

```bash
/gemini-toolkit:skill-sync path/to/my-skill/SKILL.md
/gemini-toolkit:skill-sync my-skill-name
/gemini-toolkit:skill-sync --install spec-check
```

## How to parse `$ARGUMENTS`

- Extract `--install` (boolean flag).
- The remaining argument is either a path (contains `/` or ends in `.md`) or a bare skill name. Pass it through — the script resolves bare names against `~/.claude/skills/<name>/SKILL.md`.

## How to invoke

Delegate to `gemini-skill-sync`:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/gemini-skill-sync.js \
    --skillPath "<NAME_OR_PATH>" \
    [--install true]
```

Surface `geminiSkillPath` to the user and relay any `warnings` (tools that didn't map). If `installed: true`, confirm the user can now see it in `gemini skills list`.

## Errors

| Symptom | Fix |
| --- | --- |
| `skill path not found` | Check the name or path; bare names resolve against `~/.claude/skills/` |
| `missing YAML frontmatter` | Skill file must start with `---` fence |
| `missing required frontmatter field 'name'` | Add `name: <slug>` to the skill's frontmatter |
| `gemini skills link failed` | Verify Gemini CLI >= 0.38 installed |
