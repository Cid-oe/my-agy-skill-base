# Amendment Pack — Phase 0 Corpus Reconciliation

**Status:** Proposed (ratification is Gate G0 of the Phase 1 build plan)
**Rule:** Amendments never edit RFC bodies. Each RFC remains authoritative
for its unamended text; an amendment is ratified (or rejected) on its own
record and is listed in the RFC-0000 status ledger. When an RFC is next
revised, ratified amendments are folded in and the RFC's minor version is
bumped.

## Index

| Amendment | Target RFC | Subject | Severity |
|---|---|---|---|
| [RFC-0001-A1](RFC-0001-A1.md) | Skill Resolver | Planner/Resolver layering; escalation-vs-exclusivity rule | Major |
| [RFC-0002-A1](RFC-0002-A1.md) | Skill Registry & Loader | Optional manifest blocks (methods, tools, compensations, memory); prompt-skill entryPoint; unknown-field policy | Major |
| [RFC-0003-A1](RFC-0003-A1.md) | Policy Engine | Attribute namespaces; evaluation contexts; obligations; policy snapshots; prefix matching | Major |
| [RFC-0004-A1](RFC-0004-A1.md) | Artifact System | Event payload ownership; envelope namespace; event-name normalization; mandatory maxDepth | Major |
| [RFC-0005-A1](RFC-0005-A1.md) | Runtime State | `currentNodes[]`; scoped child records with per-key CAS; watch/lease primitives; checkpoint disambiguation | Major |
| [RFC-0006-A1](RFC-0006-A1.md) | Event Bus | Open producer/event namespace registry; topic grammar; trace context; RFC-0009 reference fix | Major |
| [RFC-0007-A1](RFC-0007-A1.md) | Scheduler | Reference & dependency corrections; adopts RFC-0008 dispatch contract; cancellation alignment; Event Bus adoption | Major |
| [RFC-0008-A1](RFC-0008-A1.md) | Executor | Replaces assumed contracts (Appendix A) with published ones; policy mapping; naming fix | Major |
| [RFC-0010-A1](RFC-0010-A1.md) | Memory System | Corrects RFC-0008/0009 assumptions; Phase-1 tier subset; lesson-schema ownership | Moderate |
| [RFC-0011-A1](RFC-0011-A1.md) | Planner | ExecutionGraph = task-level DAG; Scheduler input remains ExecutionPlan; duplicate-producer semantics | Major |
| [RFC-0012-A1](RFC-0012-A1.md) | Tool Runtime | Future-RFC renumbering (Credential Store); event topic alignment | Minor |
| [RFC-0013-A1](RFC-0013-A1.md) | Reflection Engine | Trigger-topic canonicalization; Lesson schema ownership confirmation | Minor |
| [RFC-0014-A1](RFC-0014-A1.md) | Learning Engine | Model-routing ownership correction; future-RFC renumbering | Minor |
| [RFC-0015-A1](RFC-0015-A1.md) | Observability | Trace-context dependency on RFC-0006-A1; future-RFC renumbering | Minor |

**Related records:**
- [RFC-0009](../rfcs/RFC-0009.md) — number retirement (Observation Engine →
  RFC-0015; token budgeting → RFC-0016 track; model routing → RFC-0018 track).
- Future RFC number reservations (0016–0024) are defined in
  [RFC-0000 §8](../rfcs/RFC-0000.md) and must not be allocated otherwise.
