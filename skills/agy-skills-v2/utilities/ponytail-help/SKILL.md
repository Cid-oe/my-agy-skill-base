---
name: ponytail-help
id: ponytail-help
description: Use when asked what the ponytail-family skills do or which one to use — reference index for ponytail, ponytail-review, ponytail-audit, ponytail-debt, and ponytail-gain.
version: 2.0.0
entryPoint: SKILL.md
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
  - caveman-help
triggerPredicates:
  - "query_matches_family == ponytail"
exclusiveWith:
  []
---

# Ponytail Family Help

## Goal
Explain the ponytail family of skills (thorough execution and technical-debt tracking) and help pick the right one for a given need.

## Orchestration Metadata
- **Priority:** low
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.8 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** HelpQuery
- **Produces:** SkillIndex

## When to Use
- Asked 'what does ponytail do' or similar for any skill in this family
- Unsure which ponytail-family skill fits, especially within the audit → debt → gain lifecycle

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `query_matches_family == ponytail`

## Workflow
1. List each ponytail-family skill with a one-line purpose.
2. Match the described need to the right one.
3. Clarify the debt lifecycle specifically: ponytail-audit finds it, ponytail-debt tracks it, ponytail-gain closes it out.

## Avoid
- Re-explaining each skill in full instead of a one-line index.
- Confusing this with caveman-help's terse-execution family.

## Success Criteria
- The user is pointed to the right skill quickly, and understands the debt lifecycle if that's what they needed.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** caveman-help

## Works With
- caveman-help
- skill-creator
