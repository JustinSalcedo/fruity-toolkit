---
name: spec-check
description: Verify implementation against a design spec by reading the spec, grepping for referenced symbols, and running any sample scripts.
allowed-tools: [Read, Grep, Bash, WebFetch, LSP]
---

# spec-check

Compare an implementation to its design document and report drift.

## Process

1. Use `Read` to load the spec.
2. Use `Grep` to locate every symbol the spec names.
3. Use `Bash` to run any example commands in the spec and diff against expected output.
4. Use `WebFetch` to pull any externally linked references.
5. When uncertain about a type, consult `LSP` for hover info.

## Output

A short report listing matches, mismatches, and spec items not yet implemented.
