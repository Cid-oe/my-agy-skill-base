---
name: provider-execution
description: '{{if eq .Provider "codex"}}'
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
    path: packages/agent/runtimeprep/policy_templates/provider-execution.md
    format: markdown-frontmatter
---

{{if eq .Provider "codex"}}

- Codex: `{{.CLICommand}}` needs localhost/IPC. Run it normally first because the Tutti Desktop host grants command networking to its built-in Codex app-server. If `{{.CLICommand}}` reports `daemon is not reachable from this agent execution environment`, rerun once with `sandbox_permissions=require_escalated` for hosts that do not grant command networking.
  {{else if or (eq .Provider "claude") (eq .Provider "claude-code")}}
- Claude Code `Monitor` tool is disabled. Poll async Tutti jobs with one bounded shell/script.
- Claude Code: run `{{.CLICommand}}` only from a shell environment that can reach localhost/IPC. If the provider runtime cannot reach the local Tutti daemon, report that limitation; do not invent Codex `sandbox_permissions`.
  {{else if or (eq .Provider "cursor") (eq .Provider "cursor-agent") (eq .Provider "hermes") (eq .Provider "hermes-agent") (eq .Provider "nexight") (eq .Provider "tutti") (eq .Provider "openclaw") (eq .Provider "open-claw") (eq .Provider "opencode") (eq .Provider "open-code") (eq .Provider "tutti-agent")}}
- This provider must run `{{.CLICommand}}` from an execution environment with localhost/IPC access. If the daemon is unreachable from the provider runtime, report that limitation instead of retrying with provider-specific sandbox flags.
  {{end}}
