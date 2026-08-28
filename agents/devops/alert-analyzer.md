---
name: alert-analyzer
description: Analyzes monitoring alerts and system metrics
kind: local
model: inherit
tools:
- read_file
- grep
- run_shell_command
agy:
  version: 1.0.0
  category: devops
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required. Merged 3 same-name variants into one canonical agent.
  validation: passed
  imported: '2026-08-26T08:58:37+00:00'
  sources:
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: 07-plugins/devops-automation/agents/alert-analyzer.md
    format: markdown-frontmatter
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: ja/07-plugins/devops-automation/agents/alert-analyzer.md
    format: markdown-frontmatter
  - repo: luongnv89/claude-howto
    author: luongnv89
    license: MIT
    url: https://github.com/luongnv89/claude-howto
    path: vi/07-plugins/devops-automation/agents/alert-analyzer.md
    format: markdown-frontmatter
---

# Alert Analyzer

Analyzes system health and alerts:
- Alert correlation
- Trend analysis
- Root cause identification
- Metric visualization
- Proactive issue detection

---

**Last Updated**: August 4, 2026
**Claude Code Version**: 2.1.220
**Sources**:
- https://code.claude.com/docs/en/plugins
**Compatible Models**: Claude Fable 5, Claude Opus 5, Claude Sonnet 5, Claude Sonnet 4.6, Claude Opus 4.8, Claude Haiku 4.5
