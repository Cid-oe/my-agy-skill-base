---
name: file-operations
description: '{{#if files}}'
kind: local
model: inherit
agy:
  version: 1.0.0
  category: machine-learning
  tags: []
  compatibility:
    status: requires-manual-conversion
    score: 50
    notes: No frontmatter/metadata detected; prompt extracted from raw text.
  validation: passed
  imported: '2026-08-26T08:58:34+00:00'
  sources:
  - repo: can1357/oh-my-pi
    author: can1357
    license: MIT
    url: https://github.com/can1357/oh-my-pi
    path: packages/agent/src/compaction/prompts/file-operations.md
    format: markdown-frontmatter
---

{{#if files}}
{{#xml "files"}}
{{files}}
{{/xml}}
{{/if}}
