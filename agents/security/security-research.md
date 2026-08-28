---
name: security-research
description: Run the Team Mode security-research audit with 3 vulnerability hunters and 2 PoC engineers
kind: local
model: inherit
agy:
  version: 1.0.0
  category: security
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T08:58:34+00:00'
  sources:
  - repo: code-yeongyu/oh-my-openagent
    author: code-yeongyu
    license: NOASSERTION
    url: https://github.com/code-yeongyu/oh-my-openagent
    path: .agents/command/security-research.md
    format: markdown-frontmatter
---

<command-instruction>
Load and follow the `security-research` skill exactly.

```text
skill(name="security-research")
```
</command-instruction>

<user-request>
$ARGUMENTS
</user-request>
