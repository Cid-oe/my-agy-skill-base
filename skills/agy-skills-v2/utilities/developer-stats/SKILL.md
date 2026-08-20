---
name: caveman-stats
description: Use to report usage metrics for the caveman-family skills — invocation counts, compression ratios, tokens saved — when asked or periodically.
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
  - UsageLog
produces:
  - StatsReport
requires:
  []
optional:
  []
triggerPredicates:
  - "stats_requested == true"
exclusiveWith:
  []
---

# Caveman Stats

## Goal
Track and report concrete metrics on caveman-family skill usage, as real numbers rather than impressions.

## Orchestration Metadata
- **Priority:** low
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.8 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** UsageLog
- **Produces:** StatsReport

## When to Use
- Asked how often a caveman-family skill has been used
- Asked how much caveman-compress has saved
- Periodic reporting on execution-speed tooling

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `stats_requested == true`

## Workflow
1. Track invocation counts per caveman-family skill as they're used.
2. Track before/after size for caveman-compress specifically.
3. Report on request as concrete numbers, not vague impressions.

## Avoid
- Reporting impressions ('used a lot recently') instead of counted numbers.
- Inventing statistics that weren't actually tracked.

## Success Criteria
- Reported numbers are real, specific, and traceable to actual usage.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** none

## Works With
- token-budget
- caveman-compress
