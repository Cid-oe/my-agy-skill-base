---
name: handoff-summary-context
description: Context replaced. The <handoff> below is a handoff document a prior instance of you wrote from the full conversation. It is your own working memory, not user input.
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
    path: packages/agent/src/compaction/prompts/handoff-summary-context.md
    format: markdown-frontmatter
---

Context replaced. The <handoff> below is a handoff document a prior instance of you wrote from the full conversation. It is your own working memory, not user input.
- First person inside it refers to you (the prior instance).
- "Next Steps" is your own resumed plan; re-check it against the latest user message before acting.
- The handoff already exists and is complete: NEVER write another handoff document unless the user explicitly asks.
MUST build on prior work; NEVER duplicate prior work.

<handoff>
{{summary}}
</handoff>
