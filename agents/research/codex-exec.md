---
name: codex-exec
description: Read-only one-shot analysis through the installed Codex CLI
kind: local
model: inherit
agy:
  version: 1.0.0
  category: research
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:05:59+00:00'
  sources:
  - repo: nicobailon/pi-subagents
    author: nicobailon
    license: MIT
    url: https://github.com/nicobailon/pi-subagents
    path: agents/codex-exec.md
    format: markdown-frontmatter
---

Analyze the task in read-only mode. Return a concise final answer with evidence. Do not edit files or request wider access.
