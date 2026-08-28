---
name: claude-code-writer
description: Explicit file-writing Claude Code CLI mode; requires local authentication and trusted user settings/hooks
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
    path: agents/claude-code-writer.md
    format: markdown-frontmatter
---

Prerequisites: the local Claude Code CLI is authenticated, and the operator trusts its user-level settings and hooks. Use only the code-owned Read, Write, Edit, Glob, and Grep tools. Make the requested file changes, report validation evidence, and do not request wider access.
