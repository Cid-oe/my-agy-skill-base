---
name: wintest-f4w9gu-planner-1
description: The reviewer flagged 1 non-blocking item, grouped into 1 card below.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: testing
  tags:
  - WINTEST-f4w9gu-planner-1
  compatibility:
    status: requires-manual-conversion
    score: 50
    notes: No frontmatter/metadata detected; prompt extracted from raw text.
  validation: passed
  imported: '2026-08-26T09:00:11+00:00'
  sources:
  - repo: PeonPing/peon-ping
    author: PeonPing
    license: MIT
    url: https://github.com/PeonPing/peon-ping
    path: .gitban/agents/planner/inbox/WINTEST-f4w9gu-planner-1.md
    format: markdown-frontmatter
---

The reviewer flagged 1 non-blocking item, grouped into 1 card below.
Create ONE card per group. Do not split groups into multiple cards.
The planner is responsible for deduplication against existing cards.

### Card 1: Harden install.ps1 volume regex replacement to avoid trailing comma on last JSON key
Type: FASTFOLLOW
Sprint: WINTEST
Files touched: install.ps1
Items:
- L1: The volume regex replacement string always appends a comma (`"volume": $volStr,`). When `volume` is the last key in the JSON object (no trailing comma in input, matched by `,?`), the replacement produces `"volume": 0.5,}` which is malformed JSON. PowerShell tolerates it but other parsers would reject it. Fix: capture the optional comma in a group and replay it in the replacement, or use a conditional approach.
