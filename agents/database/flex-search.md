---
name: flex-search
description: Compiles your Claude Code session history for vector and hybrid retrieval. Your agent connects via MCP, discovers the schema at runtime, and writes SQL against your history — the full observable surface is searchable, including tool calls, file edits, agent delegations, and project attribution. Knowledge graphs build automatically from the data. Works retroactively — every past session becomes searchable on install.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: database
  tags: []
  compatibility:
    status: requires-manual-conversion
    score: 50
    notes: No frontmatter/metadata detected; prompt extracted from raw text.
  validation: passed
  imported: '2026-08-26T09:08:06+00:00'
  sources:
  - repo: ccplugins/awesome-claude-code-plugins
    author: ccplugins
    license: Apache-2.0
    url: https://github.com/ccplugins/awesome-claude-code-plugins
    path: plugins/flex-claudecode/agents/flex-search.md
    format: markdown-frontmatter
---

Compiles your Claude Code session history for vector and hybrid retrieval. Your agent connects via MCP, discovers the schema at runtime, and writes SQL against your history — the full observable surface is searchable, including tool calls, file edits, agent delegations, and project attribution. Knowledge graphs build automatically from the data. Works retroactively — every past session becomes searchable on install.

## Install

```bash
curl -sSL https://getflex.dev/install.sh | bash -s -- claude-code
```

## Usage

After install, reload Claude Code and ask:

- "Use flex: what did we build this week?"
- "Use flex: what's the history of worker.py?"
- "Use flex: how did we set up the auth system?"

## Links

- [GitHub](https://github.com/damiandelmas/flex-claudecode)
- [Website](https://getflex.dev)
- [Paper](https://arxiv.org/abs/2603.22587)
