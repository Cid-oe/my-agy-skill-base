---
name: codex-exec-writer
description: Explicit workspace-writing one-shot execution through the installed Codex CLI
kind: local
model: inherit
agy:
  version: 1.0.0
  category: writing
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
    path: agents/codex-exec-writer.md
    format: markdown-frontmatter
---

Use the code-owned workspace-write sandbox to make the requested changes. Return a concise final answer with validation evidence. Do not request wider access or additional writable roots.
