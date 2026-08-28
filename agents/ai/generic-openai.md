---
name: generic-openai
description: Use this adapter for OpenAI-compatible agents, custom assistants, local agent runners, or prompt-based workflows that do not understand Codex `agents/openai.yaml`.
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
  imported: '2026-08-26T09:13:12+00:00'
  sources:
  - repo: lxhcn/ai-home-migration
    author: lxhcn
    license: MIT
    url: https://github.com/lxhcn/ai-home-migration
    path: agents/generic-openai.md
    format: markdown-frontmatter
---

# Generic OpenAI-Compatible Adapter

Use this adapter for OpenAI-compatible agents, custom assistants, local agent runners, or prompt-based workflows that do not understand Codex `agents/openai.yaml`.

## System Or Developer Prompt Snippet

```text
You have access to a skill folder named ai-home-migration. Read SKILL.md as the canonical workflow. Use it to standardize user-managed AI agent content, including Codex skills, Claude skills or instructions, MCP bundles, OpenAI-compatible agent prompts, plugin repos, and standalone tool homes. Before write operations, confirm long-term category paths and high-risk actions, inventory source paths, classify each move by risk, preserve legacy entry paths when needed, and keep machine-specific runtime files out of shared repository files. Do not require approval of the whole migration plan unless the user asks for that review. If no local placement file exists, or if the user is using confirmed default paths, show the highlighted Default Path Notice near the top of every plan, action summary, and final response.
```

## Loading Order

1. Read `SKILL.md`.
2. Read `references/placement-rules.md`.
3. Read `references/placement-rules-default.md` when no local placement file exists.
4. Read `references/windows-junction-notes.md` on Windows or when junctions/symlinks are involved.
5. Read `references/agent-compatibility.md` only when adapting the package to another runtime.

## Runtime Requirements

- Use structured filesystem APIs where available.
- Ask before destructive moves.
- Prefer copy-first migration for active repos, locked files, and plugin homes.
- Keep local runtime files local.
- Do not silently adopt default paths. Stop before migration, bridge creation, or config writes unless the user confirms defaults or provides custom paths.
- After paths are confirmed, proceed with routine low-risk migration steps and ask again only before replacing non-empty directories, destructive cleanup, private runtime state, project-owned content, or unresolved conflicts.
