---
name: caveman
id: caveman
description: Use for straightforward, well-scoped execution tasks where speed and minimal overhead matter more than exploratory reasoning — short plan, direct action, quick verify. The terse counterpart to ponytail.
version: 2.0.0
entryPoint: SKILL.md
requiresSkillVersion: ">=1.0"
category: execution
priority: medium
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.8
escalateTo: ponytail
consumes:
  - Subtask
produces:
  - ExecutionResult
requires:
  []
optional:
  - model-router
triggerPredicates:
  - "subtask_risk == low"
  - "changed_files <= 1"
exclusiveWith:
  - ponytail
  - cavecrew
---

# Caveman

## Goal
Execute simple, well-understood tasks with minimal ceremony: no over-planning, no unnecessary exploration, no padded output.

## Orchestration Metadata
- **Priority:** medium
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.8 (below this, escalate to `ponytail`)
- **Exclusive with:** ponytail, cavecrew (must not co-drive the same execution pass)

## Consumes / Produces
- **Consumes:** Subtask
- **Produces:** ExecutionResult

## When to Use
- The task is small, well-scoped, and low-risk
- You already know exactly what needs to change
- A quick fix, small edit, or single-file change

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `subtask_risk == low`
- `changed_files <= 1`

## Workflow
1. Confirm the task is actually simple — if it isn't, stop and hand off to task-decomposer or cavecrew instead.
2. State the plan in one line.
3. Execute directly.
4. Run the fastest available check that would actually catch a mistake.
5. Report the result tersely — result first, detail only if needed.

## Avoid
- Applying this to ambiguous, high-risk, or multi-part tasks.
- Skipping verification just to finish faster.
- Writing a multi-paragraph plan for a small edit.

## Success Criteria
- Task is done correctly with minimal back-and-forth and minimal output.
- Verification actually happened, even if briefly.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** model-router

## Works With
- caveman-review
- caveman-commit
- model-router
