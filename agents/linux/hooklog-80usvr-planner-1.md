---
name: hooklog-80usvr-planner-1
description: The reviewer flagged 1 non-blocking item, grouped into 1 card below.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: linux
  tags:
  - HOOKLOG-80usvr-planner-1
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
    path: .claude/worktrees/agent-a9ddbd90/.gitban/agents/planner/inbox/HOOKLOG-80usvr-planner-1.md
    format: markdown-frontmatter
---

The reviewer flagged 1 non-blocking item, grouped into 1 card below.
Create ONE card per group. Do not split groups into multiple cards.
The planner is responsible for deduplication against existing cards.
All cards go into the current sprint unless marked BLOCKED with a reason.

### Card 1: Remove unconditional --all completion from completions.bash and completions.fish
Sprint: HOOKLOG
Files touched: completions.bash, completions.fish
Items:
- L1: Both completions.bash and completions.fish offer `--all` unconditionally as a top-level logs flag (from the --prune card, px9k89). Since `peon logs --all` is not a valid standalone command, this could confuse users. The unconditional `--all` entry should be removed from both files, leaving only the conditional version (after `--session`). This is tech debt from the merge of the --prune card, not introduced by card 80usvr.
