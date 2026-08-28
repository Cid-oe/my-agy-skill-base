---
name: contacts
description: '| Nickname | Email address | Group | Notes |'
kind: local
model: inherit
agy:
  version: 1.0.0
  category: productivity
  tags:
  - CONTACTS
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T08:58:27+00:00'
  sources:
  - repo: agentscope-ai/QwenPaw
    author: agentscope-ai
    license: Apache-2.0
    url: https://github.com/agentscope-ai/QwenPaw
    path: src/qwenpaw/agents/md_files/en/CONTACTS.md
    format: markdown-frontmatter
  - repo: agentscope-ai/QwenPaw
    author: agentscope-ai
    license: Apache-2.0
    url: https://github.com/agentscope-ai/QwenPaw
    path: src/qwenpaw/agents/md_files/local/en/CONTACTS.md
    format: markdown-frontmatter
  - repo: agentscope-ai/QwenPaw
    author: agentscope-ai
    license: Apache-2.0
    url: https://github.com/agentscope-ai/QwenPaw
    path: src/qwenpaw/agents/md_files/qa/en/CONTACTS.md
    format: markdown-frontmatter
---

## Contacts

| Nickname | Email address | Group | Notes |
| -------- | ------------- | ----- | ----- |
| Example: Mom | mom@example.com | Family | Send her a weekly update every Sunday |

## Maintenance Guide

- When you discover a new contact (mail from a stranger or the user
  mentions someone new), proactively add them to the table above.
- Before sending mail, look up the table first: resolve the nickname
  the user used into an email address, then send.
- If one nickname maps to multiple addresses, confirm with the user
  before sending — never guess.
