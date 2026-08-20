---
name: ponytail-audit
id: ponytail-audit
description: Use to take a point-in-time snapshot of a codebase's technical debt — known issues, workarounds, deferred TODOs — as the baseline the ponytail-debt ledger tracks against.
version: 2.0.0
entryPoint: SKILL.md
requiresSkillVersion: ">=1.0"
category: quality
priority: medium
alwaysApply: false
estimatedCost: medium
estimatedLatency: slow
estimatedContext: medium
confidenceThreshold: 0.8
escalateTo: null
consumes:
  - RepositoryMap
produces:
  - DebtInventory
requires:
  []
optional:
  - architecture-review
triggerPredicates:
  - "debt_baseline_missing == true"
  - "planning_cycle_start == true"
exclusiveWith:
  []
---

# Ponytail Audit

## Goal
Produce a concrete inventory of current technical debt: what it is, where it lives, and roughly how costly it is to leave unresolved.

## Orchestration Metadata
- **Priority:** medium
- **Estimated cost / latency / context:** medium / slow / medium
- **Confidence threshold:** 0.8 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** RepositoryMap
- **Produces:** DebtInventory

## When to Use
- Starting a debt-tracking process on a codebase for the first time
- Periodic re-baseline of outstanding debt
- Before a planning cycle where debt paydown needs to be prioritized

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `debt_baseline_missing == true`
- `planning_cycle_start == true`

## Workflow
1. Scan for TODO/FIXME and other deferred-work markers.
2. Note known workarounds and the reason each one exists.
3. Note anything previously flagged in review as 'fix later' but never resolved.
4. Estimate the rough cost of leaving each item as-is.
5. Hand the resulting inventory to ponytail-debt to record in the ledger.

## Avoid
- Vague entries like 'some cleanup needed somewhere.'
- Auditing without recording — that's what ponytail-debt is for, this skill just produces the raw findings.
- Treating every style preference as technical debt.

## Success Criteria
- Every entry is specific enough that someone else could act on it without further investigation.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** architecture-review

## Works With
- ponytail-debt
- architecture-review
