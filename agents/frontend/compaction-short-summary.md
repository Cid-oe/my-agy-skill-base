---
name: compaction-short-summary
description: Summarize conversation changes as a pull request description.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: frontend
  tags: []
  compatibility:
    status: requires-manual-conversion
    score: 50
    notes: No frontmatter/metadata detected; prompt extracted from raw text.
  validation: passed
  imported: '2026-08-26T08:58:34+00:00'
  sources:
  - repo: can1357/oh-my-pi
    author: can1357
    license: MIT
    url: https://github.com/can1357/oh-my-pi
    path: packages/agent/src/compaction/prompts/compaction-short-summary.md
    format: markdown-frontmatter
---

Summarize conversation changes as a pull request description.
MUST 2–3 sentences; first person (`I added…`, `I fixed…`); describe changes, not process.
NEVER mention tests, builds, or other validation steps; explain user request; ask questions.
