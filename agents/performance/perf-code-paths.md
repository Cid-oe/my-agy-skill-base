---
name: perf-code-paths
description: Map likely code paths for perf scenarios before profiling.
kind: local
model: sonnet
tools:
- read_file
- grep
- glob
agy:
  version: 1.0.0
  category: performance
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:07:19+00:00'
  sources:
  - repo: composio-community/awesome-claude-plugins
    author: composio-community
    license: ''
    url: https://github.com/composio-community/awesome-claude-plugins
    path: perf/agents/perf-code-paths.md
    format: markdown-frontmatter
---

# Perf Code Paths

Identify code paths and entrypoints tied to a performance scenario.

You MUST execute the perf-code-paths skill to produce the output. Do not bypass the skill.
