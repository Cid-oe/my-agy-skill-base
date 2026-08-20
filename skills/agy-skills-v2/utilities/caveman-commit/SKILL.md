---
name: caveman-commit
id: caveman-commit
description: Use when writing a git commit message — short, direct, describes what changed and why in minimal words.
version: 2.0.0
entryPoint: SKILL.md
requiresSkillVersion: ">=1.0"
category: utilities
priority: low
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.8
escalateTo: null
consumes:
  - ExecutionResult
produces:
  - CommitMessage
requires:
  []
optional:
  []
triggerPredicates:
  - "commit_message_pending == true"
exclusiveWith:
  []
---

# Caveman Commit

## Goal
Write terse, information-dense commit messages: what changed, why (if not obvious), nothing extra.

## Orchestration Metadata
- **Priority:** low
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.8 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** ExecutionResult
- **Produces:** CommitMessage

## When to Use
- About to write a commit message for a change
- A commit message draft is vague ('fix stuff,' 'updates')

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `commit_message_pending == true`

## Workflow
1. State what changed in the imperative mood in one line.
2. Add a short body only if the 'why' isn't obvious from the diff itself.
3. Skip anything the diff already shows on its own.

## Avoid
- Vague messages like 'fix stuff' or 'updates.'
- Multi-paragraph explanations for a small, self-evident change.
- Describing the diff line-by-line instead of stating the intent.

## Success Criteria
- Someone reading `git log` understands what changed and why, without opening the diff.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** none

## Works With
- caveman
- self-review
