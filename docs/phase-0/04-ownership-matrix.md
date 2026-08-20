# Phase-0 Deliverable 4 — Canonical Ownership Matrix

Rule: every concept has exactly ONE owning RFC/contract. "Co-users" consume
or extend under the owner's contract. Where two names coexist post-fork,
both are listed with distinct owners (no merges, no renames beyond the
glossary's synonym map).

## Data & contracts

| Concept | Owner | Co-users | Notes |
|---|---|---|---|
| Skill manifest & validation | RFC-0002 | 0001, 0008, 0010, 0011, 0012, 0013 | incl. `methods`, `tool_dependencies`, `compensations`, `memory_profile` (per 0002-A1) |
| ExecutionGraph (task DAG) | RFC-0011 §9.4 | 0001 (input), 0013, 0015 | Planner-owned; never a Scheduler input |
| ExecutionPlan (skill DAG) | RFC-0001 §3 | 0007 (sole consumer), 0005, 0013 | Resolver-owned; sole Scheduler input |
| Goal (Resolver input) | RFC-0001 | 0011 (producer via tasks) | `raw_request` \| `task` |
| Artifact (envelope, lineage, store, schema registry) | RFC-0004 | all | payloads per type registered here |
| Artifact events | RFC-0004 (payloads) + RFC-0006 (transport) | 0010, 0012, 0015 | names normalized per 0004-A1 R2 |
| Event (envelope, topics, delivery) | RFC-0006 | all publishers | namespaces registered per 0006-A1 R1 |
| RuntimeState / state domain | RFC-0005 | 0003, 0007, 0008, 0010–0012 | incl. per-key CAS, watch, lease primitives (0005-A1) |
| ExecutionState record (root) | RFC-0005 §3.2 | 0007, 0008 | mutator tables in 0005 §12–§13 are authoritative |
| Execution/Attempt records, command journal, lease records | RFC-0008 (schema) stored in RFC-0005 (domain) | 0013, 0015 | storage owned by 0005; record types by 0008 |
| Execution Order | RFC-0008 §7.1 | 0007 (issuer) | jointly amended (0007-A1 R2 / 0008-A1 R4) |
| PolicyDecision (5 outcomes + obligations) | RFC-0003 | all | obligations additive (0003-A1 R3) |
| Policy set snapshot / version pinning | RFC-0003 | 0008, 0014 | 0003-A1 R4 |
| Evidence (artifact type) | RFC-0004 §5.3 | 0003 (EvidencePolicy standards) | *artifact* vs *standard* split |
| Confidence (artifact field) | RFC-0004 §4.6 | 0001 (thresholds), 0003 (policy), 0011 (estimates), 0013 (calibration), 0014 (corrections) | one 0–1 scale corpus-wide |
| Ledger data shape (ResourceUsage artifact) | RFC-0004 §5.19 | 0003, 0007 | *accounting & budgets* → future RFC-0016 |
| Memory entry / tiers | RFC-0010 | 0011, 0012, 0013, 0014 | |
| Lesson (Reflection Memory schema) | RFC-0013 §8.4 | 0010 (stores), 0014 (consumes) | confirmed both sides |
| EvidenceRecord / Parameter Store | RFC-0014 | 0001, 0011, 0012 (read parameters) | single owner of learned-parameter state |
| InvocationRecord / Tool & Capability contracts / Connector Interface | RFC-0012 | 0011, 0013, 0014, 0015 | |
| Method (schema & application semantics) | RFC-0011 §9.5 | 0002 (storage/index) | 0002-A1 R1 / 0011-A1 R4 |
| Plan Artifact | RFC-0011 §7.10 | 0013, 0015 | |
| UserIntent / SystemTrigger lineage roots | RFC-0004 §5.15 (+ A: SystemTrigger) | 0011 | non-human trigger root still open → note in 0011 track |

## Behaviors & mechanisms

| Concept | Owner (semantics) | Co-users / layer mechanics | Notes |
|---|---|---|---|
| Skill selection & ordering | RFC-0001 | 0011 (upstream), 0014 (rankings input) | slot/exclusivity model is sole authority incl. duplicate producers |
| Goal decomposition (HTN) | RFC-0011 | — | Planner never resolves producers (0011-A1 R3) |
| Permission/trust gate (is this allowed) | RFC-0003 | 0002 (declaration), 0020 (enforcement) | decide vs enforce split |
| Sandbox enforcement mechanism | future RFC-0020 | 0002 §14.5 (contract), 0012 §6.9 (hooks), 0008 D-11 | contract exists; mechanism reserved |
| Scheduling (when/where/order) | RFC-0007 | — | queues, fairness, reservations |
| Execution & admission (how/whether) | RFC-0008 | — | attempts, stream offsets, finalize |
| Cancellation (execution-level) | RFC-0008 §11.6 | 0007 (task-level `CANCELLING`), 0012 (in-flight tools) | 0007-A1 R3 |
| Retry (decision authority) | RFC-0003 §7.8 RetryPolicy | 0007 (queue re-dispatch), 0008 (attempt loop), 0012 (tool retry) | ONE decision owner, three mechanical layers |
| Lease (+fence) | RFC-0008 (execution) on RFC-0005 (primitive) | — | Scheduler "Lease" deprecated → Reservation |
| Reservation | RFC-0007 §8.2 | — | pre-dispatch, time-bounded |
| Checkpoint (state domain) | RFC-0005 §9 | 0007 (Scheduler State Snapshot is separate) | stream offset ≠ checkpoint |
| Token/context budget (interim → canonical) | `token-budget` skill + RFC-0003 ContextPolicy → future RFC-0016 | 0010 (compression budget) | 0010-A1 R1 |
| Model routing (interim → canonical) | `model-router` skill → future RFC-0018 | 0014 (weights) | 0014-A1 R1 |
| Memory access policy attributes | RFC-0003 (attributes) | 0010 (Policy Gate) | |
| Reflection triggers & artifacts | RFC-0013 | 0007 (events), 0015 (dashboards) | |
| Learning application & rollback | RFC-0014 | 0001/0011/0012 (reload) | |
| Observability views / debug bundles / trace correlation | RFC-0015 | all (emitters) | |
| Escalation resolution (HITL) | future RFC-0021 (reserved) | 0003 (outcome), 0005 (Blocked), 0006 (`escalation.*` reserved) | currently unowned by everyone's own admission |
| Identity / principals | future RFC-0017 (reserved) | 0003 (opaque refs) | |
| Event namespace registration | RFC-0006 (registry) | each producer (its own payloads) | |
| RFC lifecycle & numbering | RFC-0000 | — | editor authority |

**Verification:** no concept in this table has two owners; every pre-fork
duplicate (ExecutionGraph/ExecutionPlan, Lease, checkpoint, policy dialect)
was resolved by distinct ownership + glossary synonym map, not deletion.
