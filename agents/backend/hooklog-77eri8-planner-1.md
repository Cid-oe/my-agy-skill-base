---
name: hooklog-77eri8-planner-1
description: The reviewer flagged 4 non-blocking items, grouped into 1 card below.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: backend
  tags:
  - HOOKLOG-77eri8-planner-1
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
    path: .gitban/agents/planner/inbox/HOOKLOG-77eri8-planner-1.md
    format: markdown-frontmatter
---

The reviewer flagged 4 non-blocking items, grouped into 1 card below.
Create ONE card per group. Do not split groups into multiple cards.
The planner is responsible for deduplication against existing cards.
All cards go into the current sprint unless marked BLOCKED with a reason.

### Card 1: Harden hook-logging test fixtures and coverage gaps
Sprint: HOOKLOG
Files touched: tests/setup.bash, tests/peon.bats, tests/fixtures/hook-logging/
Items:
- L1: `validate_log_fixture` word-splitting parser breaks on quoted values with spaces. Switch to a proper field extractor (Python one-liner or awk) that respects quoted values so non-wildcard fixture matching works correctly for space-containing fields.
- L3: Config-enable boilerplate (`python3 -c "import json; cfg = json.load(...); cfg['debug'] = True; ..."`) is copy-pasted across 8 test functions. Extract an `enable_debug_logging` helper into `setup.bash` to DRY up the fixture tests.
- L4: "Missing audio backend" test exercises the happy path (mock afplay present) rather than the actual error path. Add a test that removes mock audio backends from PATH to trigger and validate the `[play] error=` logging branch, fulfilling the PRD-002 acceptance criterion.
