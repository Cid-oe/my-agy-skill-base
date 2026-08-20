---
name: task-decomposer
description: Use when a request is too large or multi-part to execute directly, to break it into an ordered set of concrete, independently-verifiable subtasks.
version: 2.0
requiresSkillVersion: ">=1.0"
category: planning
priority: critical
alwaysApply: false
estimatedCost: low
estimatedLatency: medium
estimatedContext: low
confidenceThreshold: 0.85
escalateTo: null
consumes:
  - ActionableRequest
  - Spec
produces:
  - SubtaskList
requires:
  []
optional:
  - project-spec
triggerPredicates:
  - "request_parts > 1"
  - "estimated_steps > 3"
exclusiveWith:
  []
---

# Task Decomposer

## Goal
Break a large task into an ordered list of concrete subtasks, each independently completable and verifiable, sized to fit one execution pass.

## Orchestration Metadata
- **Priority:** critical
- **Estimated cost / latency / context:** low / medium / low
- **Confidence threshold:** 0.85 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** ActionableRequest, Spec
- **Produces:** SubtaskList

## When to Use
- The request has multiple distinct parts or would take many steps
- It's unclear how to start without breaking it down first
- Some subtasks could plausibly run independently of each other

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `request_parts > 1`
- `estimated_steps > 3`

## Workflow
1. Identify the end state, then work backward to the smallest set of subtasks that reach it.
2. Order subtasks by dependency.
3. Flag which subtasks are genuinely independent — those are candidates for cavecrew — versus which must run sequentially.
4. Size each subtask to fit one execution pass (caveman or ponytail, depending on stakes).

## Avoid
- Decomposing tasks that are already small enough to execute directly.
- Subtasks so granular that tracking them costs more than doing the work.
- Marking subtasks 'independent' when they actually share state or ordering constraints.

## Success Criteria
- Each subtask is independently verifiable.
- Completing all subtasks in order actually completes the original request.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** project-spec

## Works With
- cavecrew
- checkpoint-manager
- project-spec
