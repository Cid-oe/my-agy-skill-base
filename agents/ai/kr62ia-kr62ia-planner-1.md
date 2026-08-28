---
name: kr62ia-kr62ia-planner-1
description: The reviewer flagged 2 non-blocking items, grouped into 1 card below.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: ai
  tags: []
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
    path: .gitban/agents/planner/inbox/kr62ia-kr62ia-planner-1.md
    format: markdown-frontmatter
---

The reviewer flagged 2 non-blocking items, grouped into 1 card below.
Create ONE card per group. Do not split groups into multiple cards.
The planner is responsible for deduplication against existing cards.

### Card 1: Harden Windows notification template test coverage and guard parity
Type: FASTFOLLOW
Sprint: kr62ia
Files touched: `tests/win-notification-templates.Tests.ps1`, `install.ps1`
Items:
- L1: Add invoke-based `task.error` Pester test. The `task.error -> error` template key is only verified via regex match on `install.ps1` source, not by invoking the template resolution engine. Add an `Invoke-TemplateResolution` test case for `task.error` to match the coverage level of the other four keys.
- L2: Align event-override guard structure with Unix. The Unix implementation guards `idle_prompt`/`elicitation_dialog` overrides behind `event == 'Notification'`, while the Windows version uses flat `if` statements that fire regardless of `$hookEvent`. Add the guard to eliminate potential future edge case divergence.
