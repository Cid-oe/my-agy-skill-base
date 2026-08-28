---
name: perf-theory-gatherer
description: Generate top performance hypotheses after reviewing git history and current metrics.
kind: local
model: opus
tools:
- read_file
agy:
  version: 1.0.0
  category: writing
  tags: []
  compatibility:
    status: needs-tool-mapping
    score: 75
    notes: 'Unmapped tools: Bash(git:*), Bash(node:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(cargo:*), Bash(go:*), Bash(pytest:*), Bash(python:*), Bash(mvn:*), Bash(gradle:*).'
  validation: passed
  imported: '2026-08-26T09:07:19+00:00'
  sources:
  - repo: composio-community/awesome-claude-plugins
    author: composio-community
    license: ''
    url: https://github.com/composio-community/awesome-claude-plugins
    path: perf/agents/perf-theory-gatherer.md
    format: markdown-frontmatter
---

# Perf Theory Gatherer

Generate hypotheses for performance bottlenecks and regressions. You MUST read `docs/perf-requirements.md` before outputting hypotheses.

You MUST execute the perf-theory-gatherer skill to produce hypotheses. Do not bypass the skill. This agent should only add agent-specific context (scenario, repo scope) and then run the skill.
