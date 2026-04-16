---
name: gemini-toolkit
description: Four Gemini-powered capabilities for Claude Code — long-context code analysis, image generation, multimodal vision (images/PDFs), and Claude-to-Gemini skill translation. Use when a task benefits from Gemini's 1M-token window, needs image output (which Gemini CLI can't emit), involves visual inputs, or needs a Claude skill mirrored into Gemini CLI.
allowed-tools: Bash, Glob, Read
---

# gemini-toolkit

This plugin exposes four focused Gemini capabilities as commands. Each command has its own agent; each agent wraps a single Node script.

## Decision guide

| User's need | Command | Why this one |
| --- | --- | --- |
| "Map / audit / explain across many files" | `/gemini-toolkit:analyze` | Long-context window; Gemini reads files itself |
| "Describe / summarize this image or PDF" | `/gemini-toolkit:vision` | Multimodal input support |
| "Generate an image of..." | `/gemini-toolkit:imagine` | CLI path can't emit binary output |
| "Sync my Claude skill to Gemini" | `/gemini-toolkit:skill-sync` | Tool-name translation + directory scaffold |

## When NOT to use

- Small, local edits — use the normal Read/Edit loop.
- Single-file questions — native Read + your own context is faster.
- Tasks requiring Gemini to write code it can't verify — analysis, not implementation.

## Prerequisites

- `gemini` CLI ≥ 0.38 on PATH (for `analyze`, `skill-sync`).
- `GEMINI_API_KEY` env var (for `vision`, `imagine`).
- Node ≥ 22 (ships with Claude Code).
