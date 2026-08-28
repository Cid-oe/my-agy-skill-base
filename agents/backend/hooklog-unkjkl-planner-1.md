---
name: hooklog-unkjkl-planner-1
description: The reviewer flagged 2 non-blocking items, grouped into 1 card below.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: backend
  tags:
  - HOOKLOG-unkjkl-planner-1
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
    path: .claude/worktrees/agent-aeaa07d9/.gitban/agents/planner/inbox/HOOKLOG-unkjkl-planner-1.md
    format: markdown-frontmatter
  - repo: PeonPing/peon-ping
    author: PeonPing
    license: MIT
    url: https://github.com/PeonPing/peon-ping
    path: .gitban/agents/planner/inbox/HOOKLOG-unkjkl-planner-1.md
    format: markdown-frontmatter
---

The reviewer flagged 2 non-blocking items, grouped into 1 card below.
Create ONE card per group. Do not split groups into multiple cards.
The planner is responsible for deduplication against existing cards.
All cards go into the current sprint unless marked BLOCKED with a reason.

### Card 1: Extract Set-PeonConfig helper to DRY culture-swap + config-write pattern in install.ps1
Sprint: HOOKLOG
Files touched: install.ps1
Items:
- L1: The culture-save, ConvertTo-Json -Depth 10, Set-Content, culture-restore sequence now appears 8 times in install.ps1 (4 pre-existing + 2 new in debug on/off + 2 from other recent work). Extract a Set-PeonConfig helper function that takes the config object and handles the full write cycle. Each call site should reduce to 1-2 lines. This is a refactoring card — existing tests should continue to pass without modification.
