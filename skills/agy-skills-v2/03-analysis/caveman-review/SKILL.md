---
name: caveman-review
description: Use for a fast, blunt review of a small, low-risk change — correctness check without full ceremony. The terse counterpart to ponytail-review.
version: 2.0
requiresSkillVersion: ">=1.0"
category: quality
priority: medium
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.75
escalateTo: ponytail-review
consumes:
  - ExecutionResult
produces:
  - ReviewVerdict
requires:
  []
optional:
  []
triggerPredicates:
  - "change_risk == low"
  - "changed_lines < 50"
exclusiveWith:
  - ponytail-review
---

# Caveman Review

## Goal
Give fast, direct feedback on a small change: does it do what it claims, is anything obviously wrong — without a full review process.

## Orchestration Metadata
- **Priority:** medium
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.75 (below this, escalate to `ponytail-review`)
- **Exclusive with:** ponytail-review (must not co-drive the same execution pass)

## Consumes / Produces
- **Consumes:** ExecutionResult
- **Produces:** ReviewVerdict

## When to Use
- The change is small and low-risk
- A quick correctness check is enough — thoroughness isn't the priority
- ponytail-review would be overkill for the size of the change

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `change_risk == low`
- `changed_lines < 50`

## Workflow
1. Read the diff.
2. Check it does what it claims to do.
3. Check for obvious bugs, typos, or broken references.
4. Give a terse pass/fail plus the one or two things that actually matter — nothing else.

## Avoid
- Using this for large or high-risk changes — escalate to ponytail-review instead.
- Padding feedback with pleasantries or restating the diff.
- Cutting so much that an actual correctness bug gets missed.

## Success Criteria
- Obvious problems are caught quickly.
- Feedback is short but not superficial — nothing real got missed for the sake of brevity.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** none

## Works With
- caveman
- self-review
