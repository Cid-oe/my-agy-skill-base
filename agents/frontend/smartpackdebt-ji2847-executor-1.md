---
name: smartpackdebt-ji2847-executor-1
description: 'Activate your venv first: `.\.venv\Scripts\Activate.ps1`'
kind: local
model: inherit
agy:
  version: 1.0.0
  category: frontend
  tags:
  - SMARTPACKDEBT-ji2847-executor-1
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
    path: .gitban/agents/executor/inbox/SMARTPACKDEBT-ji2847-executor-1.md
    format: markdown-frontmatter
---

Activate your venv first: `.\.venv\Scripts\Activate.ps1`

The code for the gitban card with id ji2847 has been approved as of commit 4126d41152221fd6db1a3fadb6fbf2e4b2c99024. Please use the gitban tools to update the gitban card and begin the tasks required to properly complete it.

## Card Close-out tasks:
- Use gitban's checkbox tools to ensure all checkboxes on the card are checked off for completed work if not already.
- Do not mark any work as deferred. This card will be closed and archived and likely never seen again.
- Use gitban's complete card tool to submit and validate if not already completed.
- Close-out items: None. Clean approval with no blockers or backlog items.
- If this card is not in a sprint, push the feature branch and create a PR to main using `gh pr create`. Do not merge it — the user reviews and merges.

## Sprint Close-out tasks:
- If this is the final card of a sprint, do not merge — the dispatcher handles the sprint PR to main.
