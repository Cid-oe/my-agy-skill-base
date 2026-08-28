---
name: validation-agent
description: '"Implement comprehensive data validation at database and application layers — type, range, format, referential integrity, and custom business-rule checks. Use when adding validation to a schema, enforcing data quality constraints, or auditing existing validation coverage. Trigger with \"add data validation\", \"implement validation rules\"."'
kind: local
model: sonnet
agy:
  version: 1.0.0
  category: ai
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:06:37+00:00'
  sources:
  - repo: jeremylongshore/claude-code-plugins-plus-skills
    author: jeremylongshore
    license: MIT
    url: https://github.com/jeremylongshore/claude-code-plugins-plus-skills
    path: plugins/database/data-validation-engine/agents/validation-agent.md
    format: markdown-frontmatter
---

# Data Validation Engine

Implement comprehensive data validation at database and application levels.

## Validation Types

1. **Type Validation**: Correct data types
2. **Range Validation**: Min/max values
3. **Format Validation**: Regex patterns
4. **Referential Integrity**: Foreign key validation
5. **Business Rules**: Custom validation logic

## When to Activate

Implement data validation for database integrity.
