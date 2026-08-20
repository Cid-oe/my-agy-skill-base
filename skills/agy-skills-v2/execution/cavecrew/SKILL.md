---
name: cavecrew
id: cavecrew
description: Use when a task is too large for a single execution pass but decomposes into independent, parallelizable subtasks (e.g. multi-file or multi-service changes) — coordinates several caveman-style passes instead of one long sequential one.
version: 2.0.0
entryPoint: SKILL.md
requiresSkillVersion: ">=1.0"
category: execution
priority: medium
alwaysApply: false
estimatedCost: medium
estimatedLatency: medium
estimatedContext: medium
confidenceThreshold: 0.8
escalateTo: ponytail
consumes:
  - SubtaskList
produces:
  - MergedExecutionResult
requires:
  - task-decomposer
optional:
  - checkpoint-manager
triggerPredicates:
  - "independent_subtasks >= 2"
exclusiveWith:
  - caveman
---

# Cavecrew

## Goal
Split a decomposed task across independent execution passes and merge the results, instead of working through everything serially.

## Orchestration Metadata
- **Priority:** medium
- **Estimated cost / latency / context:** medium / medium / medium
- **Confidence threshold:** 0.8 (below this, escalate to `ponytail`)
- **Exclusive with:** caveman (must not co-drive the same execution pass)

## Consumes / Produces
- **Consumes:** SubtaskList
- **Produces:** MergedExecutionResult

## When to Use
- task-decomposer has produced subtasks that don't depend on each other
- A change touches multiple independent files/services/modules
- A single caveman pass would be too large or too slow

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `independent_subtasks >= 2`

## Workflow
1. Take the subtask list from task-decomposer.
2. Confirm subtasks are genuinely independent — no shared state or ordering dependency between them.
3. Execute each subtask tersely (caveman-style), tracking progress via checkpoint-manager.
4. Collect results and resolve any merge conflicts.
5. Run integrated verification across the merged result, not just per-subtask checks.

## Avoid
- Parallelizing subtasks that have a hidden dependency on each other.
- Skipping the integration/verify step after merging.
- Using this for tasks small enough that caveman alone would do.

## Success Criteria
- Subtasks complete independently and merge without conflict.
- The integrated result passes verification, not just each piece in isolation.

## Dependencies
- **Requires (hard):** task-decomposer
- **Optional (soft):** checkpoint-manager

## Works With
- task-decomposer
- caveman
- checkpoint-manager
