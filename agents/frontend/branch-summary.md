---
name: branch-summary
description: You MUST create a structured summary of the conversation branch for context when returning.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: frontend
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
    path: packages/agent/src/compaction/prompts/branch-summary.md
    format: markdown-frontmatter
---

You MUST create a structured summary of the conversation branch for context when returning.

You MUST use EXACT format:

## Goal

[What is the user trying to accomplish in this branch?]

## Constraints & Preferences
- [Constraints, preferences, requirements mentioned]
- [(none) if none mentioned]

## Progress

### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Work started but not finished]

### Blocked
- [Issues preventing progress]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [What should happen next to continue]

Sections MUST be kept concise. You MUST preserve exact file paths, function names, error messages.
