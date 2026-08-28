---
name: smartpack-aodz7v-planner-1
description: The reviewer flagged 1 non-blocking item, grouped into 1 card below.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: general
  tags:
  - SMARTPACK-aodz7v-planner-1
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
    path: .gitban/agents/planner/inbox/SMARTPACK-aodz7v-planner-1.md
    format: markdown-frontmatter
---

The reviewer flagged 1 non-blocking item, grouped into 1 card below.
Create ONE card per group. Do not split groups into multiple cards.
The planner is responsible for deduplication against existing cards.

### Card 1: Extract Get-ActivePack helper to DRY pack resolution in install.ps1
Type: FASTFOLLOW
Sprint: SMARTPACK
Files touched: install.ps1
Items:
- L1: The expression `if ($cfg.default_pack) { $cfg.default_pack } elseif ($cfg.active_pack) { $cfg.active_pack } else { "peon" }` (and its `$config.` variant) appears 10 times across install.ps1. Extract a `Get-ActivePack` helper function and replace all 10 call sites. This reduces maintenance risk when the legacy fallback key is eventually removed.
