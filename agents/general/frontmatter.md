---
name: frontmatter
description: '---'
kind: local
model: inherit
agy:
  version: 1.0.0
  category: general
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
    path: packages/coding-agent/src/prompts/agents/frontmatter.md
    format: markdown-frontmatter
---

---

name: {{jsonStringify name}}
description: {{jsonStringify description}}
{{#if spawns}}spawns: {{jsonStringify spawns}}
{{/if}}{{#if model}}model: {{jsonStringify model}}
{{/if}}{{#if thinkingLevel}}thinking-level: {{jsonStringify thinkingLevel}}
{{/if}}{{#if blocking}}blocking: true
{{/if}}{{#if prewalk}}prewalk: {{jsonStringify prewalk}}
{{/if}}{{#if advisor}}advisor: {{jsonStringify advisor}}
{{/if}}{{#if autoloadSkills}}autoloadSkills: {{jsonStringify autoloadSkills}}
{{/if}}---
{{body}}
