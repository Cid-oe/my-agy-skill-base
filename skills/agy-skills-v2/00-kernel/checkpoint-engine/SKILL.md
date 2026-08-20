---
name: checkpoint-manager
description: Use during long-running or multi-step tasks to save progress at safe points, so work can resume cleanly after an interruption instead of redoing completed steps.
version: 2.0
requiresSkillVersion: ">=1.0"
category: foundation
priority: high
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.9
escalateTo: null
consumes:
  - VerifiedSubtaskResult
produces:
  - Checkpoint
requires:
  []
optional:
  - task-decomposer
  - context-manager
triggerPredicates:
  - "step_count > 5"
  - "resuming_prior_task == true"
exclusiveWith:
  []
---

# Checkpoint Manager

## Goal
Persist enough state — what's done, what decisions were made, what's left — at sensible intervals so a task can resume without repeating verified work.

## Orchestration Metadata
- **Priority:** high
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.9 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** VerifiedSubtaskResult
- **Produces:** Checkpoint

## When to Use
- A task spans many steps or could plausibly be interrupted
- A subtask just passed verification and is safe to lock in
- Resuming a task that was previously in progress

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `step_count > 5`
- `resuming_prior_task == true`

## Workflow
1. Identify natural checkpoint points — typically right after a subtask is completed and verified, not mid-step.
2. Write a short state summary: what changed, what passed verification, what's still outstanding.
3. On resume, read the latest checkpoint before re-planning anything.
4. Prune checkpoints that are superseded so the trail doesn't grow unbounded.

## Avoid
- Checkpointing so frequently it adds more overhead than it saves.
- Recording incomplete or unverified work as if it were done.
- Re-planning from scratch on resume without reading the last checkpoint first.

## Success Criteria
- A task can resume from its last checkpoint without redoing verified work.
- Checkpoint state is accurate — nothing marked done that isn't.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** task-decomposer, context-manager

## Works With
- token-budget
- task-decomposer
- context-manager
