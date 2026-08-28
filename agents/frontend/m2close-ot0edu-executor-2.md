---
name: m2close-ot0edu-executor-2
description: Use `.venv/Scripts/python.exe` to run Python commands.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: frontend
  tags:
  - M2CLOSE-ot0edu-executor-2
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
    path: .gitban/agents/executor/inbox/M2CLOSE-ot0edu-executor-2.md
    format: markdown-frontmatter
---

Use `.venv/Scripts/python.exe` to run Python commands.

The code for the gitban card with id ot0edu has been approved as of commit 7011e78. Please use the gitban tools to update the gitban card and begin the tasks required to properly complete it.

## Card Close-out tasks:
- Use gitban's checkbox tools to ensure all checkboxes on the card are checked off for completed work if not already.
- Do not mark any work as deferred. This card will be closed and archived and likely never seen again.
- Use gitban's complete card tool to submit and validate if not already completed.
- Close-out items: CI green on Windows runner (verify post-merge -- acceptance criterion is already marked deferred on the card, so just confirm status and note it).
- If this card is not in a sprint, push the feature branch and create a draft PR to main using `gh pr create --draft`. Do not merge it -- the user reviews and merges.

Note: You are closing out this card only. The dispatcher owns sprint lifecycle -- do not close, archive, or finalize the sprint itself. The exception is a sprint close-out card, which will be obvious from its content.
