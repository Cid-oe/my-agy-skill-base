---
name: extractor
description: '|'
kind: local
model: sonnet
agy:
  version: 1.0.0
  category: backend
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:09:29+00:00'
  sources:
  - repo: athola/claude-night-market
    author: athola
    license: MIT
    url: https://github.com/athola/claude-night-market
    path: plugins/gauntlet/agents/extractor.md
    format: markdown-frontmatter
---

# Knowledge Extractor Agent

Analyze a codebase and produce `.gauntlet/knowledge.json`.

## Workflow

1. Discover source files via Glob (skip tests, configs, generated)
2. Run AST extraction:
   ```bash
   python3 plugins/gauntlet/scripts/extractor.py <target-dir> \
     --output .gauntlet/knowledge.json
   ```
3. Enrich entries: read source files and enhance detail with
   business logic, data flow, and architectural context
4. Cross-reference: link entries that share files in related_files
5. Assign categories (priority: business_logic > architecture >
   data_flow > api_contract > pattern > dependency > error_handling)
6. Validate: non-empty detail, valid difficulty (1-4), at least
   one tag
7. Save to `.gauntlet/knowledge.json`

## Error Handling

- Skip unparseable files, log warning
- Fall back to Read + Grep if script fails
- Report partial results rather than failing entirely
