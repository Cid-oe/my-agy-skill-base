---
name: architecture-review
description: Use after significant structural changes — new modules, changed data flow, new dependencies between components — to check the design against the existing architecture before it's finalized.
version: 2.0
requiresSkillVersion: ">=1.0"
category: quality
priority: high
alwaysApply: false
estimatedCost: medium
estimatedLatency: medium
estimatedContext: medium
confidenceThreshold: 0.85
escalateTo: ponytail-review
consumes:
  - RepositoryMap
  - ExecutionResult
produces:
  - ArchitectureFindings
requires:
  - repository-map
optional:
  - dependency-audit
triggerPredicates:
  - "new_module_added == true"
  - "data_flow_changed == true"
exclusiveWith:
  []
---

# Architecture Review

## Goal
Catch structural and design problems — wrong layer boundaries, unnecessary coupling, duplicated abstractions — before they're baked in.

## Orchestration Metadata
- **Priority:** high
- **Estimated cost / latency / context:** medium / medium / medium
- **Confidence threshold:** 0.85 (below this, escalate to `ponytail-review`)

## Consumes / Produces
- **Consumes:** RepositoryMap, ExecutionResult
- **Produces:** ArchitectureFindings

## When to Use
- A change adds a new module, service, or significant dependency between components
- Data flow or ownership boundaries are changing
- Something about the change feels like it might duplicate existing structure

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `new_module_added == true`
- `data_flow_changed == true`

## Workflow
1. Compare the change against repository-map's existing structure.
2. Check boundary and coupling consistency with how the rest of the codebase is organized.
3. Check whether the change duplicates an abstraction that already exists elsewhere.
4. Separate structural findings from style nitpicks — this skill is for the former.

## Avoid
- Nitpicking style or formatting — that belongs to self-review, not this.
- Running this on every small change regardless of structural impact.
- Blocking on subjective preference without a concrete structural reason.

## Success Criteria
- Structural issues are caught before merge.
- Feedback is specific and tied to the actual codebase structure, not generic advice.

## Dependencies
- **Requires (hard):** repository-map
- **Optional (soft):** dependency-audit

## Works With
- repository-map
- self-review
- dependency-audit
