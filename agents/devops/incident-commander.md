---
name: incident-commander
description: Coordinates incident response
kind: local
model: inherit
tools:
- read_file
- write_file
- run_shell_command
- grep
agy:
  version: 1.0.0
  category: devops
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required. Merged 5 same-name variants into one canonical agent.
  validation: passed
  imported: '2026-08-26T08:58:37+00:00'
  sources:
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: 07-plugins/devops-automation/agents/incident-commander.md
    format: markdown-frontmatter
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: ja/07-plugins/devops-automation/agents/incident-commander.md
    format: markdown-frontmatter
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: uk/07-plugins/devops-automation/agents/incident-commander.md
    format: markdown-frontmatter
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: vi/07-plugins/devops-automation/agents/incident-commander.md
    format: markdown-frontmatter
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: zh/07-plugins/devops-automation/agents/incident-commander.md
    format: markdown-frontmatter
---

# Incident Commander

Manages incident response:
- Severity assessment
- Team coordination
- Status updates
- Resolution tracking
- Post-mortem facilitation

---

**Last Updated**: August 4, 2026
**Claude Code Version**: 2.1.220
**Sources**:
- https://code.claude.com/docs/en/plugins
**Compatible Models**: Claude Fable 5, Claude Opus 5, Claude Sonnet 5, Claude Sonnet 4.6, Claude Opus 4.8, Claude Haiku 4.5
