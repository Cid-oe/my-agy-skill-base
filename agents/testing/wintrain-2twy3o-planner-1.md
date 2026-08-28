---
name: wintrain-2twy3o-planner-1
description: The reviewer flagged 2 non-blocking items, grouped into 2 cards below.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: testing
  tags:
  - WINTRAIN-2twy3o-planner-1
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
    path: .gitban/agents/planner/inbox/WINTRAIN-2twy3o-planner-1.md
    format: markdown-frontmatter
---

The reviewer flagged 2 non-blocking items, grouped into 2 cards below.
Create ONE card per group. Do not split groups into multiple cards.
The planner is responsible for deduplication against existing cards.

### Card 1: Consolidate peon.ps1 Write-StateAtomic calls into a single end-of-hook flush
Type: FASTFOLLOW
Sprint: WINTRAIN
Files touched: install.ps1 (embedded peon.ps1)
Items:
- L1: The `peon.ps1` hook currently calls `Write-StateAtomic` at lines 1422, 1576, and 1687 -- up to three disk writes per invocation. The Unix reference (`peon.sh`) uses a `state_dirty` flag and writes once at the end. The PowerShell code already has a `$stateDirty` variable (line 1325) that is set but never consumed. Refactor to a single end-of-hook `Write-StateAtomic` call, gated by `$stateDirty`, to reduce I/O, match the Unix pattern, and fulfill the "single atomic write" promise in ADR-002.

### Card 2: Add Pester tests for trainer hook reminder logic
Type: FASTFOLLOW
Sprint: WINTRAIN
Files touched: tests/adapters-windows.Tests.ps1 (or new tests/trainer-windows.Tests.ps1)
Items:
- L2: The trainer reminder block (~130 lines in peon.ps1) shipped without Pester tests. Tests should cover: date reset, completion skip, interval gating, SessionStart bypass, slacking detection threshold, manifest read failure graceful degradation, and zero-overhead when trainer is disabled. Note: the yq8iba review already routed a related item (L3) for trainer CLI subcommand tests -- the planner should determine whether to merge these into a single card or keep them separate based on scope.
