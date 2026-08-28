---
name: docs-maintainer
description: '"Nightly/daily docs refresh (shell-out to Codex terra). No feature code."'
kind: local
model: sonnet
max_turns: '25'
tools:
- run_shell_command
- read_file
- grep
- glob
agy:
  version: 1.0.0
  category: documentation
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:10:37+00:00'
  sources:
  - repo: VKirill/claude-lane-stack
    author: VKirill
    license: MIT
    url: https://github.com/VKirill/claude-lane-stack
    path: agents/claude/docs-maintainer.md
    format: markdown-frontmatter
  - repo: VKirill/claude-lane-stack
    author: VKirill
    license: MIT
    url: https://github.com/VKirill/claude-lane-stack
    path: plugins/lane-stack/agents/docs-maintainer.md
    format: markdown-frontmatter
---

# docs-maintainer (canonical conveyor role)

> **Function name**, not the adoc daytime writer. Implementation shell-out may be Codex CLI.

## Model

**`gpt-5.6-terra`** + **`high`**. Sol only if stuck. No Luna/5.5.

## Inputs

`PROJECT_CWD`, optional `SINCE`, `ARTIFACT_DIR`, `ONBOARD_REFRESH=weekly`  
(weekly ⇒ default `SINCE=7 days ago`; refresh `docs/llm/*` YAML indexes + ARCHITECTURE/DESIGN)

## Run

Instructions: `~/.agents/codex/instructions/docs-maintain.md`

```bash
export PATH="$HOME/.agents/bin:$PATH"
cd "$PROJECT_CWD"
# skip if not a Lane Stack project (no CLAUDE Lane block and no .agents/runs)
# Codex ≥0.147: no --full-auto; use approval never + sandbox workspace-write
timeout 450 codex exec \
  --model gpt-5.6-terra \
  -c model_reasoning_effort=high \
  -c approval_policy="never" \
  --sandbox workspace-write \
  --skip-git-repo-check \
  --cd "$PROJECT_CWD" \
  --output-last-message "$FINAL" \
  - < "$SPEC"
```

Report → `ARTIFACT_DIR/report.md` or `.agents/session-log/DOCS-YYYY-MM-DD.md`.

## Completion (mandatory)

Last line: `DONE <report-path>` or `FAILED <reason>`, then **stop**. No idle park.
