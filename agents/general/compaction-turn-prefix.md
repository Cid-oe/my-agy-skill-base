---
name: compaction-turn-prefix
description: Turn prefix too large; recent-work suffix retained.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: general
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
    path: packages/agent/src/compaction/prompts/compaction-turn-prefix.md
    format: markdown-frontmatter
---

Turn prefix too large; recent-work suffix retained.

MUST summarize prefix for retained suffix:

## Original Request

[What did the user ask for in this turn?]

## Early Progress
- [Key decisions and work done in the prefix]

## Context for Suffix
- [Information needed to understand the retained recent work]

MUST output only the structured summary; NEVER extra text.

MUST concise. MUST preserve exact file paths, function names, error messages, relevant tool outputs, and command results if present. MUST focus on information needed to understand the retained suffix.
