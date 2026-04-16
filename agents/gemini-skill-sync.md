---
name: gemini-skill-sync
description: |
  Use to translate a Claude Code skill (YAML frontmatter + Markdown body) into a Gemini-native skill. Produces a directory at `~/.gemini/skills/synced/<name>/` with a `SKILL.md` inside, and can optionally run `gemini skills link` to activate it.

  <example>
  Context: User has a Claude skill they also want available in Gemini CLI
  user: "Sync my spec-check skill to Gemini"
  assistant: "Routing to gemini-skill-sync — it'll translate the tool references (Read→read_file, Grep→grep_search, etc.) and install it."
  </example>
tools: [Bash, Glob, Read]
model: sonnet
---

# gemini-skill-sync

Translate a Claude Code skill file into the Gemini skill format.

## How to invoke

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/gemini-skill-sync.js \
    --skillPath path/to/my-skill/SKILL.md \
    --install true
```

Flags:
- `--skillPath` (required): path to a Claude skill `.md` file or a directory containing `SKILL.md`. Bare skill names are resolved against `~/.claude/skills/<name>/SKILL.md`.
- `--install` (optional, default `false`): when `true`, runs `gemini skills link <target>` after writing.

## Tool mapping

The script rewrites Claude tool references in the skill body to their Gemini equivalents:

| Claude | Gemini |
| --- | --- |
| `Read` | `read_file` |
| `Grep` | `grep_search` |
| `Glob` | `glob` |
| `Bash` | `run_shell_command` |
| `Edit` | `replace` |
| `Write` | `write_file` |
| `WebSearch` | `google_web_search` |
| `WebFetch` | `web_fetch` |

Tools not in this table surface as warnings — the skill still syncs, but you should review the output and manually adapt those sections.

## Reading the output

Envelope: `{ ok, geminiSkillPath, installed, warnings }`. Tell the user where the synced skill lives and relay any warnings. If `installed: true`, confirm it shows up in `gemini skills list`.
