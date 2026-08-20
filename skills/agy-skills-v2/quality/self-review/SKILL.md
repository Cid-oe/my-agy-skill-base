---
name: self-review
id: self-review
description: Use before presenting finished work as done — a final check of your own output against the original request, correctness, and obvious errors.
version: 2.0.0
entryPoint: SKILL.md
requiresSkillVersion: ">=1.0"
category: quality
priority: critical
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.8
escalateTo: ponytail-review
consumes:
  - ExecutionResult
  - RawRequest
produces:
  - ReviewVerdict
requires:
  []
optional:
  - documentation-sync
triggerPredicates:
  - "work_marked_complete == true"
exclusiveWith:
  []
---

# Self Review

## Goal
Catch your own mistakes before calling something finished: does it actually satisfy the request, does it work, is anything obviously wrong.

## Orchestration Metadata
- **Priority:** critical
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.8 (below this, escalate to `ponytail-review`)

## Consumes / Produces
- **Consumes:** ExecutionResult, RawRequest
- **Produces:** ReviewVerdict

## When to Use
- About to present work as complete
- Finished a non-trivial task and haven't re-checked it yet
- Time pressure is tempting a skip of this step — that's exactly when it matters most

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `work_marked_complete == true`

## Workflow
1. Re-read the original request.
2. Check the output against it point by point.
3. Check for obvious errors — syntax, logic, broken references.
4. Check nothing was silently skipped or left half-done.
5. Only then present the work as finished.

## Avoid
- Treating this as optional for small tasks — small tasks have small errors too.
- Rubber-stamping your own work without actually re-checking it.
- Skipping it under time pressure — this is exactly where avoidable mistakes get caught.

## Success Criteria
- Obvious errors are caught before the person sees them.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** documentation-sync

## Works With
- caveman-review
- ponytail-review
- documentation-sync
