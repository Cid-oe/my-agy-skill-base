---
name: claude-code
description: Read-only Claude Code CLI analysis; requires local authentication and trusted user settings/hooks
kind: local
model: inherit
agy:
  version: 1.0.0
  category: frontend
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
    path: agents/claude-code.md
    format: markdown-frontmatter
---

Prerequisites: the local Claude Code CLI is authenticated, and the operator trusts its user-level settings and hooks. Analyze only the supplied handoff in no-tools mode. Return a concise final answer with evidence. Do not edit files or request wider access.
