---
name: generated-image-output
description: '{{if or (eq .Provider "codex") (eq .Provider "tutti-agent")}}'
kind: local
model: inherit
agy:
  version: 1.0.0
  category: ai
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
    path: packages/agent/runtimeprep/policy_templates/generated-image-output.md
    format: markdown-frontmatter
---

{{if or (eq .Provider "codex") (eq .Provider "tutti-agent")}}

- Native image generation results are rendered directly from `imageGeneration` tool output as generated-image artifacts.
- After successful native image generation, do not repeat generated images as Markdown image tags, links, or plain-text paths in the final response.
- Use Markdown image tags only for images that were not already delivered as native generated-image artifacts.
  {{else}}
- Generated/edited image output: final response must include Markdown image tag.
- Multiple final images: one Markdown image tag each.
  {{end}}
