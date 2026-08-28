---
name: alert-analyzer-general
description: Аналізує алерти моніторингу та метрики системи
kind: local
model: inherit
tools:
- read_file
- grep
- run_shell_command
- write_file
agy:
  version: 1.0.0
  category: general
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required. Merged 2 same-name variants into one canonical agent.
  validation: passed
  imported: '2026-08-26T08:58:37+00:00'
  sources:
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: uk/07-plugins/devops-automation/agents/alert-analyzer.md
    format: markdown-frontmatter
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: zh/07-plugins/devops-automation/agents/alert-analyzer.md
    format: markdown-frontmatter
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: uk/07-plugins/documentation/agents/example-generator.md
    format: markdown-frontmatter
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: zh/07-plugins/documentation/agents/example-generator.md
    format: markdown-frontmatter
---

# Аналізатор алертів

Аналізує стан системи та алерти:
- Кореляція алертів
- Аналіз трендів
- Визначення першопричини
- Візуалізація метрик
- Проактивне виявлення проблем
