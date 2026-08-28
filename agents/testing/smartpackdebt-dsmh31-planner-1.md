---
name: smartpackdebt-dsmh31-planner-1
description: The reviewer flagged 2 non-blocking items, grouped into 1 card below.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: testing
  tags:
  - SMARTPACKDEBT-dsmh31-planner-1
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
    path: .gitban/agents/planner/inbox/SMARTPACKDEBT-dsmh31-planner-1.md
    format: markdown-frontmatter
---

The reviewer flagged 2 non-blocking items, grouped into 1 card below.
Create ONE card per group. Do not split groups into multiple cards.
The planner is responsible for deduplication against existing cards.

### Card 1: Add CI lint check for python3 -c bash quoting hazards
Type: BACKLOG
Sprint: none
Files touched: CI config (new), potentially tests/
Items:
- L1: Add a CI lint check (shellcheck custom rule or BATS test) that detects `python3 -c "` blocks containing `["` or `.get("` patterns, to prevent regression of the quoting bug class fixed in card dsmh31. The card's own "Process Improvements" section already identified this opportunity.
