---
name: verified-endpoint-output
description: '- Report each verified user-reachable HTTP(S) endpoint as a descriptive Markdown link using `[label](url)`.'
kind: local
model: inherit
agy:
  version: 1.0.0
  category: backend
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
    path: packages/agent/runtimeprep/policy_templates/verified-endpoint-output.md
    format: markdown-frontmatter
---

## Local Server Output

- Report each verified user-reachable HTTP(S) endpoint as a descriptive Markdown link using `[label](url)`.
- Do not wrap a user-reachable URL or its Markdown link in backticks.
- Trust only server output, tool results, or host-provided port mappings. Never invent, guess, or assume a port or URL.
- If none is available, say so and provide the verified listening address and port as inline code.
