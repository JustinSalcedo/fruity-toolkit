# fruity-toolkit

A Claude Code marketplace bundling plugins for creative and design-ops work. Currently ships:

- **gemini-toolkit** (`plugins/gemini-toolkit`) — Gemini CLI + API integration: long-context code analysis, image generation, multimodal vision, Claude-to-Gemini skill sync, and a project-aware mockup orchestrator with fidelity-scored iteration.
- **mockup-prompt** (`plugins/mockup-prompt`) — Model-agnostic UI mockup prompt generation with guardrails against common AI image defects (device chrome, perspective warp, garbled text).

More plugins will land here as the collection grows.

## Install

```bash
/plugin marketplace add JustinSalcedo/fruity-toolkit
/plugin install gemini-toolkit@fruity-toolkit
/plugin install mockup-prompt@fruity-toolkit
/reload-plugins
```

## License

MIT — see individual plugin repos for their own licenses.
