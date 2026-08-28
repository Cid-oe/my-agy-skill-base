---
name: subagent-search
description: Search the 4,250 indexed AGY subagent registry using BM25 FTS5 by keyword, task, or category.
argument-hint: "<query> [--category <cat>] [--limit <n>]"
---

# subagent-search

Search the local AGY Subagent SQLite FTS5 registry without loading the full catalog into context.

## Usage
Run the search command locally:
```bash
python3 -c "from subagent_engine import SubagentRouter; import sys, json; r = SubagentRouter(); print(json.dumps(r.search('$ARGUMENTS', limit=5), indent=2))"
```
