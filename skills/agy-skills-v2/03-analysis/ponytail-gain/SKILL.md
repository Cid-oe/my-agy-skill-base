---
name: ponytail-gain
description: Use after work that pays down technical debt — refactors, fixing workarounds, removing deferred TODOs — to record the paydown against the ponytail-debt ledger.
version: 2.0
requiresSkillVersion: ">=1.0"
category: quality
priority: medium
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.85
escalateTo: null
consumes:
  - ExecutionResult
  - DebtLedger
produces:
  - PaydownRecord
requires:
  - ponytail-debt
optional:
  []
triggerPredicates:
  - "workaround_resolved == true"
  - "todo_resolved == true"
exclusiveWith:
  []
---

# Ponytail Gain

## Goal
Record when technical debt is actually paid down, closing out the corresponding ledger entries — and note any new debt the fix introduced.

## Orchestration Metadata
- **Priority:** medium
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.85 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** ExecutionResult, DebtLedger
- **Produces:** PaydownRecord

## When to Use
- Just finished a refactor or fix that resolves a known workaround
- A previously-flagged TODO is now actually resolved
- Closing out items after a debt-paydown-focused work cycle

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `workaround_resolved == true`
- `todo_resolved == true`

## Workflow
1. Identify which ledger entries this work resolves.
2. Confirm the underlying issue is actually fixed, not just moved elsewhere.
3. Update ponytail-debt to close those specific entries.
4. Note any new debt the fix itself introduced, so it doesn't go untracked.

## Avoid
- Closing entries based on intent rather than a confirmed fix.
- Ignoring new debt the fix introduces on the way to resolving the old debt.

## Success Criteria
- The ledger reflects real paydown, not aspirational paydown.
- New debt introduced by the fix is captured, not lost.

## Dependencies
- **Requires (hard):** ponytail-debt
- **Optional (soft):** none

## Works With
- ponytail-debt
- ponytail-audit
