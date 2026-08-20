---
name: ponytail
description: Use for careful, higher-stakes execution passes where correctness and traceability matter more than speed — e.g. changes to shared or critical code. The deliberate, thorough counterpart to caveman.
version: 2.0
requiresSkillVersion: ">=1.0"
category: execution
priority: high
alwaysApply: false
estimatedCost: high
estimatedLatency: slow
estimatedContext: medium
confidenceThreshold: 0.9
escalateTo: null
consumes:
  - Subtask
produces:
  - ExecutionResult
requires:
  []
optional:
  - checkpoint-manager
triggerPredicates:
  - "subtask_risk == high"
  - "changed_files_shared == true"
exclusiveWith:
  - caveman
---

# Ponytail

## Goal
Execute higher-stakes changes carefully and traceably: explicit reasoning up front, incremental changes, full verification, no shortcuts.

## Orchestration Metadata
- **Priority:** high
- **Estimated cost / latency / context:** high / slow / medium
- **Confidence threshold:** 0.9 (no escalation target — terminal skill)
- **Exclusive with:** caveman (must not co-drive the same execution pass)

## Consumes / Produces
- **Consumes:** Subtask
- **Produces:** ExecutionResult

## When to Use
- The change touches shared, critical, or widely-depended-on code
- Getting it wrong would be costly to unwind
- Speed matters less than someone later understanding why each decision was made

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `subtask_risk == high`
- `changed_files_shared == true`

## Workflow
1. State the plan and the reasoning behind it explicitly before acting.
2. Make changes incrementally, checking after each increment rather than all at once.
3. Document why each non-obvious change was made, not just what changed.
4. Run full verification — not just the fastest check that would pass.
5. Summarize what changed and why at the end.

## Avoid
- Using this for trivial tasks where caveman would do — it's slower on purpose.
- Skipping the documentation of reasoning to save time (that defeats the point).
- Treating thoroughness as a reason to never finish.

## Success Criteria
- Change is correct, each step is traceable, and someone reviewing it later understands why each decision was made.
- Full verification actually ran, not just a quick smoke check.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** checkpoint-manager

## Works With
- ponytail-review
- self-review
- checkpoint-manager
