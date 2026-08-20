---
name: caveman-help
description: Use when asked what the caveman-family skills do or which one to use — reference index for caveman, cavecrew, caveman-commit, caveman-compress, caveman-review, and caveman-stats.
version: 2.0
requiresSkillVersion: ">=1.0"
category: utilities
priority: low
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.8
escalateTo: null
consumes:
  - HelpQuery
produces:
  - SkillIndex
requires:
  []
optional:
  - ponytail-help
triggerPredicates:
  - "query_matches_family == caveman"
exclusiveWith:
  []
---

# Caveman Family Help

## Goal
Explain the caveman family of skills (fast, terse execution and its variants) and help pick the right one for a given need.

## Orchestration Metadata
- **Priority:** low
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.8 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** HelpQuery
- **Produces:** SkillIndex

## When to Use
- Asked 'what does caveman do' or similar for any skill in this family
- Unsure which caveman-family skill fits a given task

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `query_matches_family == caveman`

## Workflow
1. List each caveman-family skill with a one-line purpose.
2. Match the described need to the right one.
3. Point to the ponytail-family (via ponytail-help) as the thorough counterpart when the task actually calls for more care than speed.

## Avoid
- Re-explaining every skill in full instead of a one-line index — that's what each SKILL.md is for.
- Recommending a caveman-family skill for a task that actually needs ponytail's thoroughness.

## Success Criteria
- The user is pointed to the right skill quickly.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** ponytail-help

## Works With
- ponytail-help
- skill-creator
