---
name: prompt-coach
id: prompt-coach
description: Use when a request is ambiguous, underspecified, or likely to produce a poor result as written, to sharpen it into something actionable before executing — with minimal back-and-forth.
version: 2.0.0
entryPoint: SKILL.md
requiresSkillVersion: ">=1.0"
category: planning
priority: high
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.85
escalateTo: null
consumes:
  - RawRequest
produces:
  - ActionableRequest
requires:
  []
optional:
  - task-decomposer
  - project-spec
triggerPredicates:
  - "request_ambiguity == high"
exclusiveWith:
  []
---

# Prompt Coach

## Goal
Turn a vague or underspecified request into an actionable one, asking only for what actually changes the approach.

## Orchestration Metadata
- **Priority:** high
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.85 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** RawRequest
- **Produces:** ActionableRequest

## When to Use
- A request could reasonably be interpreted multiple different ways with different outcomes
- Missing information would materially change what gets built
- Proceeding as-written risks doing the wrong thing entirely

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `request_ambiguity == high`

## Workflow
1. Identify what's genuinely missing or ambiguous — not everything unstated, only what actually changes the approach.
2. If a reasonable default exists, state the assumption and proceed instead of asking.
3. If not, ask the smallest number of clarifying questions that resolve the ambiguity — one where possible.
4. Avoid interrogating for details that wouldn't change the outcome either way.

## Avoid
- Asking questions that have an obvious sensible default.
- Asking more than necessary before starting.
- Blocking entirely on clarification when a stated assumption would let work proceed.

## Success Criteria
- The request becomes actionable with minimal back-and-forth.
- Any assumption made is stated explicitly, not silently baked in.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** task-decomposer, project-spec

## Works With
- task-decomposer
- project-spec
