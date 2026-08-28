---
name: translate
description: translate English to other languages
kind: local
model: opencode/gpt-5.6-sol
agy:
  version: 1.0.0
  category: writing
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T08:58:27+00:00'
  sources:
  - repo: anomalyco/opencode
    author: anomalyco
    license: MIT
    url: https://github.com/anomalyco/opencode
    path: .opencode/command/translate.md
    format: markdown-frontmatter
---

run git diff and translate changed english doc and UI copy files to other international languages. Translate all languages in parallel to save time.

Requirements:

- Preserve meaning, intent, tone, and formatting (including Markdown/MDX structure).
- Preserve all technical terms and artifacts exactly: product/company names, API names, identifiers, code, commands/flags, file paths, URLs, versions, error messages, config keys/values, and anything inside inline code or code blocks.
- Also preserve every term listed in the Do-Not-Translate glossary below.
- Also apply locale-specific guidance from `.opencode/glossary/<locale>.md` when available (for example, `zh-cn.md`).
- Do not modify fenced code blocks.
