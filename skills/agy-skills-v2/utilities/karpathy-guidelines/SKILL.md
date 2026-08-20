---
name: karpathy-guidelines
description: Use as a general coding-philosophy check on generated code — favor simple, readable, deletable code over clever abstraction, and flag generated code that's more complex than the problem warrants.
version: 2.0
requiresSkillVersion: ">=1.0"
category: utilities
priority: medium
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.75
escalateTo: self-review
consumes:
  - ExecutionResult
produces:
  - SimplicityFindings
requires:
  []
optional:
  - self-review
  - architecture-review
triggerPredicates:
  - "code_generated == true"
exclusiveWith:
  []
---

# Karpathy Guidelines

## Goal
Apply a simplicity-first coding philosophy: prefer obvious, readable code over premature abstraction, and be suspicious of code that's more complex than the problem needs.

## Orchestration Metadata
- **Priority:** medium
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.75 (below this, escalate to `self-review`)

## Consumes / Produces
- **Consumes:** ExecutionResult
- **Produces:** SimplicityFindings

## When to Use
- Reviewing freshly-generated code before finalizing it
- A generated solution feels more elaborate than the problem calls for
- Deciding between a simple approach and a more 'flexible' abstracted one

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `code_generated == true`

## Workflow
1. After writing or generating code, ask whether a simpler version would do the same job.
2. Prefer explicit code over clever one-liners that trade readability for brevity.
3. Prefer deleting code over adding a flag or abstraction built for a single use case.
4. Flag over-engineered generated code for simplification before it ships.

## Avoid
- Using 'keep it simple' as an excuse to skip structure a genuinely complex problem needs.
- Simplifying in a way that sacrifices correctness.

## Success Criteria
- Code is as simple as the problem allows — not simpler, not more elaborate.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** self-review, architecture-review

## Works With
- self-review
- architecture-review
