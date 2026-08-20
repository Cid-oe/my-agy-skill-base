---
name: ponytail-debt
id: ponytail-debt
description: Use to maintain a running ledger of known technical debt over time — what's outstanding, what's been paid down — so debt is tracked rather than forgotten.
version: 2.0.0
entryPoint: SKILL.md
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
  - DebtInventory
  - PaydownRecord
produces:
  - DebtLedger
requires:
  - ponytail-audit
optional:
  - ponytail-gain
triggerPredicates:
  - "new_debt_items_found == true"
  - "paydown_reported == true"
exclusiveWith:
  []
---

# Ponytail Debt Ledger

## Goal
Maintain a persistent ledger of technical debt items across time: added, resolved, and still open — not just a one-off snapshot.

## Orchestration Metadata
- **Priority:** medium
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.85 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** DebtInventory, PaydownRecord
- **Produces:** DebtLedger

## When to Use
- New items came out of a ponytail-audit pass
- A paydown needs to be recorded (via ponytail-gain)
- Someone needs to know what debt is currently outstanding

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `new_debt_items_found == true`
- `paydown_reported == true`

## Workflow
1. Take new items from ponytail-audit and add them to the ledger with date, location, and cost estimate.
2. Mark items resolved only when ponytail-gain confirms an actual paydown.
3. Periodically re-surface old unresolved items rather than letting them age silently out of view.

## Avoid
- Letting resolved items linger marked 'open.'
- Adding items without enough detail to act on them later.
- Treating this ledger as a general feature to-do list rather than debt specifically.

## Success Criteria
- The ledger accurately reflects outstanding debt at any point in time.
- Every entry traces back to a specific audit or gain event.

## Dependencies
- **Requires (hard):** ponytail-audit
- **Optional (soft):** ponytail-gain

## Works With
- ponytail-audit
- ponytail-gain
- ponytail-review
