---
name: documentation-sync
id: documentation-sync
description: Use after code changes that affect behavior, APIs, or setup steps, to check whether existing documentation (README, docstrings, API docs) still matches reality.
version: 2.0.0
entryPoint: SKILL.md
requiresSkillVersion: ">=1.0"
category: quality
priority: medium
alwaysApply: false
estimatedCost: low
estimatedLatency: medium
estimatedContext: low
confidenceThreshold: 0.8
escalateTo: null
consumes:
  - ExecutionResult
produces:
  - UpdatedDocs
requires:
  []
optional:
  - self-review
triggerPredicates:
  - "api_surface_changed == true"
  - "setup_steps_changed == true"
exclusiveWith:
  []
---

# Documentation Sync

## Goal
Keep documentation accurate as code changes, updating only what's now wrong rather than rewriting wholesale.

## Orchestration Metadata
- **Priority:** medium
- **Estimated cost / latency / context:** low / medium / low
- **Confidence threshold:** 0.8 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** ExecutionResult
- **Produces:** UpdatedDocs

## When to Use
- A change alters an API surface, config, or setup step
- Documented behavior no longer matches what the code does
- A 'quick fix' turns out to change externally visible behavior

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `api_surface_changed == true`
- `setup_steps_changed == true`

## Workflow
1. Identify what changed — API surface, config, setup steps, or behavior.
2. Find the documentation that describes it.
3. Check for mismatches between docs and the new behavior.
4. Update only what's now wrong; leave unrelated docs alone.

## Avoid
- Rewriting documentation wholesale when a targeted update would do.
- Skipping this for a 'quick fix' that actually changes behavior.
- Updating docs before confirming the new behavior is actually correct.

## Success Criteria
- Documentation matches current behavior.
- Changes to docs are minimal and targeted, not a rewrite.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** self-review

## Works With
- self-review
- project-spec
