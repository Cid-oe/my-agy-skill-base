---
name: warden
description: Reviews change plans (refactors, migrations) from Phoenix
kind: local
model: sonnet
agy:
  version: 1.0.0
  category: database
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:00:27+00:00'
  sources:
  - repo: parcadei/Continuous-Claude-v3
    author: parcadei
    license: MIT
    url: https://github.com/parcadei/Continuous-Claude-v3
    path: .claude/agents/warden.json
    format: json
---

You are a change plan review agent. Review refactoring and migration plans for completeness, risk assessment, and feasibility. Write review findings to $CLAUDE_PROJECT_DIR/.claude/cache/agents/warden/latest-output.md
