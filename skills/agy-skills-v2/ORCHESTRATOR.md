# Orchestrator

The v1 pack was a collection of independently useful skills. v2 adds the
metadata (priority, cost, confidence, consumes/produces, trigger predicates,
exclusivity, version pins) needed for a **resolver** to assemble a pipeline
automatically instead of relying on manual invocation or prompt matching.

## Pipeline shape

```
User Goal
   |
   v
Prompt Coach ---------------------> (clarifies ambiguous requests)
   |
   v
Project Spec ----------------------> (for new features/projects only)
   |
   v
Task Decomposer
   |
   v
Skill Resolver  <-- reads: priority, requires, optional, triggerPredicates,
   |                        estimatedCost, confidenceThreshold, exclusiveWith
   |
   +-- Foundation layer (as needed): Context Manager, Repository Map,
   |                                  Token Budget, Checkpoint Manager
   |
   +-- Execution layer (mutually exclusive per subtask):
   |     - Caveman / Cavecrew   (low-risk, low-cost path)
   |     - Ponytail             (high-stakes path)
   |     - Gemini Delegate      (large-context / multimodal subtasks)
   |     resolved via Model Router using cost + confidence data
   |
   v
Quality layer:
   - Self Review (always)
   - Caveman Review / Ponytail Review (mutually exclusive, by risk)
   - Architecture Review, Security Audit, Dependency Audit (conditional
     on triggerPredicates, e.g. new_module_added, handles_user_input)
   - Documentation Sync
   - Ponytail Audit -> Ponytail Debt -> Ponytail Gain (debt lifecycle,
     independent of the main execution path)
```

## Resolution algorithm (informal)

1. **Decompose.** `task-decomposer` turns the goal into a `SubtaskList`.
2. **Match.** For each subtask, the resolver evaluates every skill's
   `triggerPredicates` against current task state (file counts, risk level,
   token counts, etc.) to build a candidate set.
3. **Filter by dependency.** Drop any candidate whose `requires` aren't
   satisfied yet; queue them behind the skill that `produces` what they
   `consume`.
4. **Filter by exclusivity.** Within a candidate set, drop lower-priority
   members of any `exclusiveWith` pair (e.g. `caveman` and `ponytail` never
   both drive the same execution pass).
5. **Rank.** Sort remaining candidates by `priority`, then by
   `estimatedCost` (cheapest sufficient option wins — this is what
   `model-router` already does one level down, for model choice within a
   skill).
6. **Execute.** Run the top candidate. Compare its actual result confidence
   against `confidenceThreshold`.
7. **Escalate or continue.** Below threshold, hand off to `escalateTo`.
   At or above it, mark the subtask's `produces` artifact available and
   move to the next subtask/layer.
8. **Checkpoint.** After each verified subtask, `checkpoint-manager`
   persists state so the graph can resume without re-running satisfied
   nodes.

## Why this matters

Before: adding a new capability meant writing a new skill *and* hand-coding
where it plugs into the flow.

After: adding a new capability means adding one node — a `SKILL.md` with
consistent frontmatter — and the resolver places it correctly because the
graph edges (`requires`, `optional`, `consumes`, `produces`,
`exclusiveWith`, `triggerPredicates`) are declared, not implied.

This is the difference between a skill *library* (things a human or model
picks from) and a skill *graph* (things a resolver assembles into a
pipeline on its own).
