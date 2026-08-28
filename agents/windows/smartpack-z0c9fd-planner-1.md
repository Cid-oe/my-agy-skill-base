---
name: smartpack-z0c9fd-planner-1
description: The reviewer flagged 2 non-blocking items, grouped into 1 card below.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: windows
  tags:
  - SMARTPACK-z0c9fd-planner-1
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
    path: .gitban/agents/planner/inbox/SMARTPACK-z0c9fd-planner-1.md
    format: markdown-frontmatter
---

The reviewer flagged 2 non-blocking items, grouped into 1 card below.
Create ONE card per group. Do not split groups into multiple cards.
The planner is responsible for deduplication against existing cards.

### Card 1: Harden Windows atomic state I/O edge cases
Type: BACKLOG
Sprint: none
Files touched: install.ps1 (embedded peon.ps1 hook)
Items:
- L1: `Write-StateAtomic` has a non-atomic window between `[IO.File]::Delete` and `[IO.File]::Move`. On PS 7+ this could use `Move-Item -Force` which is truly atomic. Add a PS version check to use the safer path when available. Low risk given sub-millisecond window but worth hardening.
- L2: The safety timer fires `[Environment]::Exit(1)` which skips `finally` blocks and cleanup. If state has been partially written, it could leave a `.tmp` file behind. Consider whether `exit 1` (which runs trap handlers) would be safer, or add a `.tmp` cleanup check on next startup in `Read-StateWithRetry`.
