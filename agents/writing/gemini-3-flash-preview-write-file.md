---
name: gemini-3-flash-preview-write-file
description: 'Please create a file at /tmp/demo-write.txt with exactly this content: ''hello write demo line one\nhello line two''.'
kind: local
model: gemini-3-flash-preview
agy:
  version: 1.0.0
  category: writing
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:00:15+00:00'
  sources:
  - repo: tiann/hapi
    author: tiann
    license: AGPL-3.0
    url: https://github.com/tiann/hapi
    path: cli/src/agent/backends/acp/__fixtures__/gemini-3-flash-preview-write-file.json
    format: json
---

Please create a file at /tmp/demo-write.txt with exactly this content: 'hello write demo line one\nhello line two'.
