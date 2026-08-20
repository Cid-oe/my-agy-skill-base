# AGY glossary (canonical)

Terminology per RFC-0000 §10. Where an RFC defines a term in more detail,
that RFC is cited. Cross-RFC synonyms are listed so readers can map legacy
prose to canonical terms.

## Kernel

- **Artifact** — Durable, immutable, checksummed data unit; envelope+payload; owned by RFC-0004.
- **ArtifactType** — Registered payload schema name+version in the Artifact Schema Registry (RFC-0004 §7).
- **Checkpoint** — Durable `RuntimeStateSnapshot` artifact of an execution's state domain (RFC-0005 §9). *Not* the same as a **stream offset** (RFC-0008 §8.4).
- **Decision / PolicyDecision** — The five-outcome decision `ALLOW|DENY|MODIFIED|ESCALATE|DEFER` (RFC-0003 §5). "Decision artifact" is its RFC-0004 §5.4 envelope.
- **Escalation** — An `ESCALATE` outcome or `escalateTo` handoff. Owner of *resolution* is reserved RFC-0021.
- **Event** — Immutable notification of a committed fact; at-least-once, per-topic ordered (RFC-0006).
- **Execution** — One logical unit of skill work under one Order; 1..N Attempts (RFC-0008).
- **Execution Graph** — *Task-level* DAG produced by the Planner (RFC-0011 §9.4). Input to the Resolver.
- **Execution Plan** — *Skill-level* DAG produced by the Resolver (RFC-0001 §3). Sole input to the Scheduler.
- **Execution Order (Order)** — The Scheduler's immutable dispatch instruction to the Executor (RFC-0007-A1 R2 / RFC-0008 §7.1).
- **ExecutionState record** — The root record of an execution's RuntimeState domain (RFC-0005 §3.2, as amended).
- **Goal** — Resolver input: `raw_request` or a Planner `task` (RFC-0001 §3, as amended).
- **Lease (+fence)** — Executor-held exclusive write ownership of an Execution, enforced by RuntimeState fence checks (RFC-0008 §11.7; primitives RFC-0005-A1 R4).
- **Method** — HTN decomposition rule stored in a skill manifest (RFC-0011 §9.5; storage RFC-0002-A1 R1).
- **Obligation** — A constraint returned with a PolicyDecision that must be enforced for the remainder of the work (RFC-0003-A1 R3).
- **Plan Artifact** — The Planner's complete planning record (RFC-0011 §7.10).
- **Policy Set Snapshot** — Immutable, identified version of the registered policy set; pinnable per Execution (RFC-0003-A1 R4).
- **Reservation** — Pre-dispatch time-bounded resource claim held by the Scheduler (RFC-0007 §8.2). *Not* a lease.
- **RuntimeState** — The live, scoped state of one execution instance (RFC-0005). Storage unit: the **state domain** (RFC-0005-A1 R2).
- **Skill** — A packaged capability with a validated manifest (RFC-0002 §3).
- **Skill Registry / Loader** — Trust root: discovery, validation, indices, load/unload lifecycle (RFC-0002).
- **Slot** — One unit of resolution work: an artifact need with ranked candidate skills (RFC-0001 §5).
- **State domain** — `runtimestate/{executionId}/` namespace: root record + designated-mutator child records (RFC-0005-A1 R2).
- **Task** — Scheduler unit: a plan node wrapped in scheduling state (RFC-0007 §2).
- **Trust Level** — `local | local-verified | verified` provenance tier for skill packages (RFC-0002 §14.1).

## Platform

- **Connector** — Protocol implementation under the Tool Runtime's Connector Interface (RFC-0012 §5.2).
- **Tool / Tool Capability** — External capability and its schema-bound named operation (RFC-0012 §5.3).
- **InvocationRecord** — Auditable record of one tool invocation (RFC-0012 §8.8).
- **Memory Tier** — Working/Episodic/Semantic/Long-term/Reflection/Project/User (RFC-0010 §5.2).
- **Lesson** — Canonical Reflection Memory entry schema (RFC-0013 §8.4).
- **EvidenceRecord / Parameter Store** — Learning Engine's normalized evidence and governed parameter state (RFC-0014 §6.2/§6.5).

## Lifecycle & status words

- **Draft / Review / Accepted / Implemented / Superseded / Deprecated / Archived** — RFC lifecycle statuses (RFC-0000 §5.1).
- **Amendment (RFC-00NN-Ax)** — Recorded, ratifiable change to an RFC; never an in-place edit.
- **Type dependency vs runtime dependency** — Data-contract sharing (no load order) vs calls/reads (build order) (RFC-0000 §3).

## Legacy synonym map (pre-reconciliation prose)

| Legacy term | Canonical |
|---|---|
| ExecutionGraph (as Scheduler input) | Execution Plan (RFC-0001); ExecutionGraph is Planner-owned |
| Scheduler Lease | Reservation (Scheduler) / Lease (Executor-owned) |
| Stream checkpoint (RFC-0008) | Stream offset |
| Scheduler checkpoint (RFC-0007 §12) | Scheduler State Snapshot |
| `permit/deny/obligate` (RFC-0008 App. A) | `ALLOW/DENY/MODIFIED` (+obligations) |
| `ArtifactCreated` … (RFC-0004 §10) | `artifact.artifact.created` … (RFC-0006-A1 R2 aliases) |
| Observation Engine / "RFC-0009" | Observability (RFC-0015); number 0009 retired |
| "RFC-0004: Execution Runtime" (RFC-0007 §0) | RFC-0008 Executor |
| Task Decomposer (kernel sense) | Planner (RFC-0011); `task-decomposer` is a *skill* |
