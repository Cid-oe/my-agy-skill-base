---
name: github-debug
description: '> 从 web-search-agent.md 提取的 GitHub/Debug 专用策略'
kind: local
model: inherit
agy:
  version: 1.0.0
  category: testing
  tags: []
  compatibility:
    status: requires-manual-conversion
    score: 50
    notes: No frontmatter/metadata detected; prompt extracted from raw text.
  validation: passed
  imported: '2026-08-26T09:07:15+00:00'
  sources:
  - repo: Weizhena/Deep-Research-skills
    author: Weizhena
    license: MIT
    url: https://github.com/Weizhena/Deep-Research-skills
    path: agents/web-search-modules/github-debug.md
    format: markdown-frontmatter
---

# GitHub Debug Module

> 从 web-search-agent.md 提取的 GitHub/Debug 专用策略

**触发场景**: 项目bug、error调试、issue查找、版本特定问题

## 搜索源
- **GitHub Issues** (both open and closed) - excellent for known bugs and workarounds

## 查询策略 (1.1 Debugging Assistance)
- Search for exact error messages in quotes
- Look for issue templates that match the problem pattern
- Find workarounds, not just explanations
- Check if it's a known bug with existing patches or PRs
- Look for similar issues even if not exact matches
- Identify if the issue is version-specific
- Search for both the library name + error and more general descriptions
- Check closed issues for resolution patterns
