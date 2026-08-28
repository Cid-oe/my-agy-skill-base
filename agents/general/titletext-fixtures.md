---
name: titletext-fixtures
description: '['
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
  imported: '2026-08-26T09:00:55+00:00'
  sources:
  - repo: tutti-os/tutti
    author: tutti-os
    license: Apache-2.0
    url: https://github.com/tutti-os/tutti
    path: packages/agent/titletext-fixtures.json
    format: json
---

[
  {
    "name": "plain text",
    "input": "  hello   world ",
    "normalized": "hello world"
  },
  {
    "name": "file path with spaces",
    "input": "[@renderer.js](/Users/Sun/first cc/renderer.js)",
    "normalized": "@renderer.js"
  },
  {
    "name": "href with parentheses",
    "input": "[report](file:///tmp/a_(final).md)",
    "normalized": "report"
  },
  {
    "name": "escaped label",
    "input": "[a\\[b\\]](https://example.com)",
    "normalized": "a[b]"
  },
  {
    "name": "unmatched link stays readable",
    "input": "[not a link](missing",
    "normalized": "[not a link](missing"
  }
]
