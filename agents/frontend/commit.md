---
name: commit
description: git commit and push
kind: local
model: opencode/kimi-k2.5
agy:
  version: 1.0.0
  category: frontend
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T08:58:27+00:00'
  sources:
  - repo: anomalyco/opencode
    author: anomalyco
    license: MIT
    url: https://github.com/anomalyco/opencode
    path: .opencode/command/commit.md
    format: markdown-frontmatter
---

commit and push

make sure it includes a prefix like
docs:
tui:
core:
ci:
ignore:
wip:

For anything in the packages/web use the docs: prefix.

prefer to explain WHY something was done from an end user perspective instead of
WHAT was done.

do not do generic messages like "improved agent experience" be very specific
about what user facing changes were made

if there are conflicts DO NOT FIX THEM. notify me and I will fix them

## GIT DIFF

!`git diff`

## GIT DIFF --cached

!`git diff --cached`

## GIT STATUS --short

!`git status --short`
