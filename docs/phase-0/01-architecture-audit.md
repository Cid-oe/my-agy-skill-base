# Phase-0 Deliverable 1 — Architecture Audit (Contradiction Register)

**Input:** `docs/architecture/2026-08-20-architecture-review.md`
**Output:** every identified contradiction with its Phase-0 disposition.
**Rule applied:** Amendment / Deprecation / Compatibility layer / Migration
note — never a silent rewrite. No subsystem was redesigned.

| ID | Contradiction | Disposition | Record |
|---|---|---|---|
| C-01 | ExecutionPlan (RFC-0001) vs ExecutionGraph (RFC-0011) as Scheduler input | **Compatibility layer**: layer Planner→Resolver→Scheduler; both schemas survive with distinct owners | RFC-0001-A1 R1/R4, RFC-0011-A1 R1/R2/R3 |
| C-02 | Scheduler §11 dispatch/lease vs Executor §7 Dispatch/lease+fence | **Amendment**: Executor contract canonical; Scheduler adopts Orders; Scheduler "Lease" deprecated → Reservation | RFC-0007-A1 R2, RFC-0008-A1 R4 |
| C-03 | Cancellation: CANCELLED-on-issue (0007 §11.4) vs cooperative grace (0008 §11.6) | **Amendment**: `CANCELLING` intermediate state; terminal on Executor confirmation or budget expiry (preserves both intents) | RFC-0007-A1 R3 |
| C-04 | Policy enums: 5 outcomes (0003) vs permit/deny/obligate + obligations + principals (0008) | **Amendment** (additive): obligations field; DecisionRequest; outcome mapping table; 5-outcome enum stays canonical | RFC-0003-A1 R3/R4, RFC-0008-A1 R1 |
| C-05 | Policy attributes/contexts demanded by 0010/0011/0012/0013/0014, absent in 0003 | **Amendment**: `attributes` map + `evaluationContext` + namespace registration | RFC-0003-A1 R1/R2 |
| C-06 | Policy snapshot pinning (0008 §19.1) undefined | **Amendment**: `PolicySetVersionId` | RFC-0003-A1 R4 |
| C-07 | RuntimeState: single object + domain CAS (0005) vs scoped keys + per-key CAS/watch/leases (0008) | **Amendment**: state domains with root + child records; per-record CAS + domainRevision; watch/lease primitives owned by 0005 | RFC-0005-A1 R2–R4, RFC-0008-A1 R3 |
| C-08 | RFC-0005 §18.1 self-declared defect: `currentNode` cannot express parallel execution | **Amendment** (its own required fix): `currentNodes[]` | RFC-0005-A1 R1 |
| C-09 | Artifact `Create/Commit` (0008) vs `create/supersede` (0004) | **Compatibility layer**: manifest is an Artifact; Commit = create of manifest | RFC-0008-A1 R2 |
| C-10 | Artifact namespaces per Execution (0008 §19.2) undefined | **Amendment**: envelope `namespace` + bucketing rule | RFC-0004-A1 R1 |
| C-11 | Event Bus closed enum/producer allowlist (0006) vs `memory.*`/`tool.*`/… publishers (0010–0015) | **Amendment**: governed open namespace registry; grandfathering alias table | RFC-0006-A1 R1/R2 |
| C-12 | Scheduler never adopted the Event Bus; downstream expects `scheduler.*` events | **Amendment**: Scheduler publishes observation topics; control channel stays direct (documented equivalence) | RFC-0007-A1 R5, RFC-0013-A1 R1, RFC-0015-A1 R2 |
| C-13 | "RFC-0004: Execution Runtime" numbering collision (RFC-0007 §0/§4.1) | **Migration note** + amendment: all references corrected; depends-on header completed | RFC-0007-A1 R1 |
| C-14 | False substrate assumptions: "0008=model routing, 0009=token budgeting" (0010, 0014) | **Deprecation of assumption** + re-pointing to `model-router`/`token-budget` skills interim, RFC-0018/RFC-0016 canonical; RFC-0009 retired by record | RFC-0010-A1 R1, RFC-0014-A1 R1, `docs/rfcs/RFC-0009.md` |
| C-15 | Future-RFC number collisions (≥8 suggestions across 0010–0015) | **Deprecation of suggestions**; reservation registry 0016–0024 + unassigned pool | RFC-0000 §8; per-RFC amendments R-renumbering |
| C-16 | Escalate-into-exclusiveWith-partner undefined (caveman→ponytail, caveman-review→ponytail-review) | **Amendment**: escalation vacates the failed assignment before constraint-check | RFC-0001-A1 R3, RFC-0002-A1 R4 |
| C-17 | RFC status chaos (all Draft/Proposed vs "stable"/"accepted" claims) | **Compatibility layer**: RFC-0000 status ledger + lifecycle definitions; nothing Accepted yet, explicitly | RFC-0000 §5–§6 |
| C-18 | Skill pack non-conformance (paths, dirs, semver, ids, entryPoints, symmetry) | **Data fix** (this phase): layout canonicalized, manifest regenerated | Deliverable 06 |
| C-19 | `checkpoint` triple-overloaded (0005/0007/0008) | **Migration note**: Checkpoint / Scheduler State Snapshot / stream offset | RFC-0005-A1 R5, RFC-0007-A1 R4, RFC-0008-A1 R3 |
| C-20 | Trace context absent from Event envelope (0015 dependency) | **Amendment**: optional `traceId`/`spanId` | RFC-0006-A1 R3 |

**Open items deliberately NOT resolved in Phase 0** (require design, not
reconciliation; tracked in RFC-0000 §8): Resource Manager/Ledger, Identity
& Credentials, Sandbox enforcement, Session, Model Registry, Escalation
owner, Kernel bootstrap, Plugin distribution, Data sovereignty.
