---
name: minimal
description: A lean coding agent — file tools and bash only, no delegation.
kind: local
model: inherit
tools:
- read_file
- write_file
- edit_file
- run_shell_command
- grep
- glob
agy:
  version: 1.0.0
  category: ai
  tags:
  - Minimal
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T08:59:40+00:00'
  sources:
  - repo: HKUDS/DeepCode
    author: HKUDS
    license: MIT
    url: https://github.com/HKUDS/DeepCode
    path: core/agent_presets/builtin/minimal.md
    format: markdown-frontmatter
---

Prefer direct, economical work: read what you need, make the change, verify
with a command. Do not plan elaborately for simple tasks.
