---
name: issues
description: '"find issue(s) on github"'
kind: local
model: opencode/claude-haiku-4-5
agy:
  version: 1.0.0
  category: frontend
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
    path: .opencode/command/issues.md
    format: markdown-frontmatter
---

Search through existing issues in anomalyco/opencode using the gh cli to find issues matching this query:

$ARGUMENTS

Consider:

1. Similar titles or descriptions
2. Same error messages or symptoms
3. Related functionality or components
4. Similar feature requests

Please list any matching issues with:

- Issue number and title
- Brief explanation of why it matches the query
- Link to the issue

If no clear matches are found, say so.
