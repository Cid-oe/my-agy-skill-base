---
name: model-router
id: model-router
description: Use when a task could be handled by different models or tools (e.g. a lightweight model, a stronger model, or Gemini) at different cost/capability tradeoffs, to route each subtask to the cheapest one that can actually do it.
version: 2.0.0
entryPoint: SKILL.md
requiresSkillVersion: ">=1.0"
category: foundation
priority: critical
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.85
escalateTo: ponytail
consumes:
  - SubtaskList
produces:
  - RoutingPlan
requires:
  - task-decomposer
optional:
  - gemini-skill
  - token-budget
triggerPredicates:
  - "subtask_count > 1"
  - "cost_sensitivity == high"
exclusiveWith:
  []
---

# Model Router

## Goal
Route each subtask to the least expensive model/tool capable of doing it correctly, rather than defaulting every subtask to the most powerful option.

## Orchestration Metadata
- **Priority:** critical
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.85 (below this, escalate to `ponytail`)

## Consumes / Produces
- **Consumes:** SubtaskList
- **Produces:** RoutingPlan

## When to Use
- A task decomposes into subtasks of clearly different difficulty
- A subtask is better suited to another tool's strengths (e.g. very large context, multimodal input)
- Cost or latency matters for the task at hand

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `subtask_count > 1`
- `cost_sensitivity == high`

## Workflow
1. Classify each subtask's difficulty and ambiguity before routing it.
2. Route trivial/mechanical subtasks to the lightest capable option, ambiguous or high-stakes subtasks to the strongest one.
3. Consider gemini-skill specifically when a subtask needs a strength Gemini has (huge context ingestion, multimodal) rather than by default.
4. Verify output quality after routing; escalate to a stronger option if the result is wrong or incomplete.

## Avoid
- Routing everything to the most powerful/expensive option by default.
- Routing genuinely ambiguous or high-stakes reasoning to a lightweight model to save cost.
- Treating routing as one-time — not escalating when a routed subtask comes back wrong.

## Success Criteria
- Correct output achieved at the lowest sufficient cost.
- Escalation actually happens when a routed result is inadequate.

## Dependencies
- **Requires (hard):** task-decomposer
- **Optional (soft):** gemini-skill, token-budget

## Works With
- token-budget
- gemini-skill
- caveman
- cavecrew
