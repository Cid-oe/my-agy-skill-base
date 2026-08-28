---
name: cursor-agent-writer
description: Explicit workspace-writing one-shot execution through the installed Cursor CLI
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
    path: agents/cursor-agent-writer.md
    format: markdown-frontmatter
---

Use the code-owned sandbox to make the requested workspace changes. Return a concise final answer with validation evidence. Do not request wider access or additional workspace roots.
