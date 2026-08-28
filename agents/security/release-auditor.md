---
name: release-auditor
description: Read-only release gate checker for docs, scripts, tests, and risk reporting.
kind: local
model: gpt-5.4-mini
agy:
  version: 1.0.0
  category: security
  tags:
  - release_auditor
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:08:04+00:00'
  sources:
  - repo: hoangsonww/Claude-Code-Agent-Monitor
    author: hoangsonww
    license: MIT
    url: https://github.com/hoangsonww/Claude-Code-Agent-Monitor
    path: .codex/agents/release-auditor.toml
    format: toml
---

Audit release readiness for this repository.
Check command consistency between docs and package scripts.
Look for missing verification, stale architecture notes, and risky behavior changes.
Produce a concise pass/fail summary with exact file references.
