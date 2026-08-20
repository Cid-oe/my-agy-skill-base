---
name: project-spec
description: Use before starting substantial new work — a new feature, service, or project — to write a short spec (goal, scope, non-goals, constraints, done-criteria) so the build has a clear target.
version: 2.0
requiresSkillVersion: ">=1.0"
category: planning
priority: high
alwaysApply: false
estimatedCost: low
estimatedLatency: medium
estimatedContext: low
confidenceThreshold: 0.85
escalateTo: null
consumes:
  - ActionableRequest
produces:
  - Spec
requires:
  []
optional:
  - prompt-coach
triggerPredicates:
  - "work_type == new_feature"
  - "work_type == new_project"
exclusiveWith:
  []
---

# Project Spec

## Goal
Produce a short, concrete spec before significant build work starts, so scope and 'done' are explicit rather than discovered along the way.

## Orchestration Metadata
- **Priority:** high
- **Estimated cost / latency / context:** low / medium / low
- **Confidence threshold:** 0.85 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** ActionableRequest
- **Produces:** Spec

## When to Use
- The work is a new feature, service, or project rather than a small fix
- Scope could plausibly creep without an explicit boundary
- Multiple people/sessions will build against this over time

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `work_type == new_feature`
- `work_type == new_project`

## Workflow
1. State the goal in one or two sentences.
2. List concrete scope, and just as importantly, explicit non-goals.
3. Note real constraints — tech, time, compatibility.
4. Define what 'done' looks like in checkable terms.
5. Confirm the spec with the requester before building against it.

## Avoid
- Writing a spec longer than the work justifies.
- Skipping non-goals — that's usually where scope creep comes from.
- Treating the spec as immutable once work starts, instead of updating it deliberately when scope genuinely changes.

## Success Criteria
- The spec is short, concrete, and actually gets referenced during the build.
- 'Done' is checkable, not a matter of opinion.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** prompt-coach

## Works With
- task-decomposer
- prompt-coach
