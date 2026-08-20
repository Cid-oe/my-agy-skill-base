---
name: ponytail-review
description: Use for a thorough review pass on a significant or high-risk change — correctness, edge cases, and consistency with existing patterns. The deliberate counterpart to caveman-review.
version: 2.0
requiresSkillVersion: ">=1.0"
category: quality
priority: high
alwaysApply: false
estimatedCost: high
estimatedLatency: slow
estimatedContext: medium
confidenceThreshold: 0.9
escalateTo: null
consumes:
  - ExecutionResult
  - RepositoryMap
produces:
  - ReviewVerdict
requires:
  []
optional:
  - architecture-review
triggerPredicates:
  - "change_risk == high"
  - "shared_code_touched == true"
exclusiveWith:
  - caveman-review
---

# Ponytail Review

## Goal
Give a thorough review of a significant change: correctness, edge cases, and consistency with existing patterns — not just 'does it run.'

## Orchestration Metadata
- **Priority:** high
- **Estimated cost / latency / context:** high / slow / medium
- **Confidence threshold:** 0.9 (no escalation target — terminal skill)
- **Exclusive with:** caveman-review (must not co-drive the same execution pass)

## Consumes / Produces
- **Consumes:** ExecutionResult, RepositoryMap
- **Produces:** ReviewVerdict

## When to Use
- The change is significant, high-risk, or touches shared/critical code
- caveman-review would be insufficient for the stakes involved
- A change needs sign-off before merging into something widely depended on

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `change_risk == high`
- `shared_code_touched == true`

## Workflow
1. Read the full diff and its surrounding context.
2. Check edge cases and error handling explicitly.
3. Check consistency with existing patterns using repository-map.
4. Check test coverage for the change.
5. Give specific feedback organized by severity, not a flat list.

## Avoid
- Using this for trivial changes — use caveman-review instead.
- Vague feedback like 'this could be cleaner' with no specifics.
- Approving without actually checking edge cases.

## Success Criteria
- Feedback is specific, prioritized by severity, and catches issues a fast review would miss.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** architecture-review

## Works With
- ponytail
- self-review
- architecture-review
