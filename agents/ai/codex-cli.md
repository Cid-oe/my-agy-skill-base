---
name: codex-cli
description: '"Execute OpenAI Codex CLI (GPT-5.2) for code analysis. Use when you need Codex''s GPT-5.2 perspective on code."'
kind: local
model: haiku
tools:
- run_shell_command
agy:
  version: 1.0.0
  category: ai
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:06:46+00:00'
  sources:
  - repo: centminmod/my-claude-code-setup
    author: centminmod
    license: MIT
    url: https://github.com/centminmod/my-claude-code-setup
    path: .claude/agents/codex-cli.md
    format: markdown-frontmatter
---

# CLI Passthrough Agent

Execute the Codex CLI command with the user's prompt. Use appropriate shell based on platform:

## Platform Detection

First, detect the platform and choose the shell:
- **macOS (darwin)**: Use `zsh -i -c` (if codex alias in ~/.zshrc) or direct `codex` command
- **Linux**: Use `bash -i -c` (if codex alias in ~/.bashrc) or direct `codex` command
- **Windows**: Use `powershell -Command` or direct `codex` command

## Execution (timeout: 120000ms)

**Direct command (preferred if codex is in PATH):**

```bash
codex -p readonly exec "USER_PROMPT" --json
```

**For macOS (if codex needs shell config):**

```bash
zsh -i -c "codex -p readonly exec 'USER_PROMPT' --json"
```

**For Linux (if codex needs shell config):**

```bash
bash -i -c "codex -p readonly exec 'USER_PROMPT' --json"
```

**For Windows (PowerShell):**

```powershell
powershell -Command "codex -p readonly exec 'USER_PROMPT' --json"
```

Substitute USER_PROMPT with the input, execute, return only raw output.
