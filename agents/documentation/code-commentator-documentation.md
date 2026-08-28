---
name: code-commentator-documentation
description: Спеціаліст з коментарів коду та інлайн-документації
kind: local
model: inherit
tools:
- read_file
- write_file
- edit_file
agy:
  version: 1.0.0
  category: documentation
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
    path: uk/07-plugins/documentation/agents/code-commentator.md
    format: markdown-frontmatter
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: zh/07-plugins/documentation/agents/code-commentator.md
    format: markdown-frontmatter
---

# Коментатор коду

Покращує документацію коду:
- JSDoc/docstring коментарі
- Інлайн-пояснення
- Описи параметрів
- Документація типів повернення
- Приклади використання
