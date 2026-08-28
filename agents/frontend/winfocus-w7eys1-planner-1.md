---
name: winfocus-w7eys1-planner-1
description: The reviewer flagged 3 non-blocking items, grouped into 2 cards below.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: frontend
  tags:
  - WINFOCUS-w7eys1-planner-1
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
    path: .gitban/agents/planner/inbox/WINFOCUS-w7eys1-planner-1.md
    format: markdown-frontmatter
---

The reviewer flagged 3 non-blocking items, grouped into 2 cards below.
Create ONE card per group. Do not split groups into multiple cards.
The planner is responsible for deduplication against existing cards.

### Card 1: Add behavioral mocks for Find-FocusableWindow and drain event queue after activation
Type: FASTFOLLOW
Sprint: WINFOCUS
Files touched: tests/win-click-to-focus.Tests.ps1, scripts/win-notify.ps1
Items:
- L1: Structural tests could be supplemented with behavioral mocks for Find-FocusableWindow. The priority chain logic (return first process with a visible window, in order) is the most important behavioral contract. A Pester test that dot-sources just the function definition, mocks Get-Process to return controlled process objects, and asserts the return value would catch regressions that string-matching cannot (e.g., someone reorders the priority list or changes the Where-Object filter).
- L2: Event queue not drained after activation. When the Activated event fires, Get-Event returns the event object but the code does not call Remove-Event to clear it from the queue. The Unregister-Event at cleanup removes the subscription but does not guarantee the queued event is removed. Add Remove-Event call after Get-Event in the activation path.

### Card 2: WSL click-to-focus activation handler
Type: BACKLOG
Sprint: none
Files touched: scripts/notify.sh
Items:
- L3: WSL click-to-focus activation handler is deferred. The WSL path gets the launch attribute placeholder but no activation handler. The design doc's Open Question #2 explains why (inline PowerShell exits immediately, conflicts with setsid & backgrounding). Track as a follow-up if WSL users request parity.
