# AGY Final Design Review — Pre-Implementation Sign-Off

**Board:** Principal Systems Architect / Final Design Review Board
**Date:** 2026-08-21
**Canonical state under review:** RFC-0000…RFC-0015 (RFC-0009 retired), the A1 amendment pack (status: Proposed), the Phase-0 deliverables, the repaired skill pack (`skills/agy-skills-v2/`), and `AGY_HANDOFF.md`.
**Scope:** architectural correctness only. Style, grammar, formatting excluded.
**Method:** full-corpus re-read post-reconciliation, plus mechanical verification of the load-bearing seams (status vocabularies, predicate variables, event namespace registrations, amendment cross-grants, artifact-type duplication, boot-time dependencies). Every finding below cites RFC and section. Findings were verified by script where marked [V].

**Severity classes used:** CRITICAL (implementation impossible) · HIGH (blocks a build stage or creates dual sources of truth; must be amended before the stage it blocks) · MEDIUM (ambiguity that will silently diverge in code; amend before or with the affected stage) · LOW (record; fix opportunistically) · FUTURE (reserved-RFC track).

---

## Phase 1 — Architecture Validation (Master Issue Register)

**Scope:** every subsystem checked for ownership, responsibilities,
interfaces, lifecycle, dependency direction, runtime flow, data ownership,
and implementation feasibility. The register below is the consolidated
output; subsequent phases reference these IDs.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| H1 | HIGH | Two execution-status state machines with **zero defined mapping** | RFC-0005 §4.1–4.2 (Created…Archived, 12 states) vs RFC-0008 §10.1 (ADMITTED…TIMED_OUT, 11+3 states). [V] No mapping exists in either RFC or any A1 amendment. |
| H2 | HIGH | Resolver's `RuntimeState` input fields and the **entire predicate-variable vocabulary are unowned** | RFC-0001 §3 (`conversationTokens`, `filesTouched`, `changedFiles`, `costSensitivity`, `availableArtifacts`) exists in no later RFC; RFC-0005 §3.2 ExecutionState defines none of them; RFC-0002 §3.2 validates predicates against a "known RuntimeState field set" that no document defines. [V] All 45 distinct predicate variables in the skill pack are undefined in RFC-0005's schema. With RFC-0001 §9 fail-closed semantics, an unregistered variable **disables every skill that references it**. |
| H3 | HIGH | Task re-dispatch ↔ Execution identity undefined | RFC-0007 §4.1 (`RETRYING → READY`, "attempt count += 1") vs RFC-0008 §7.1/§11.1 (`executionId = H(planId‖stepId‖orderId)`; idempotent re-dispatch returns `AlreadyAdmitted`). Whether a Scheduler retry issues a new Order (new Execution, orphaned attempt history) or reuses the orderId (collides with a lease-lost Execution) is unspecified. |
| H4 | HIGH | Scheduler has **no background-job API**, but four subsystems register jobs with it | RFC-0010 §4 (RFC-0007: "registers ScheduledJob entries… cron-style intervals"), RFC-0013 §9.1, RFC-0014 §9, RFC-0015 §9.1 vs RFC-0007 §2/§3 (Task/Worker/Queue only — no ScheduledJob concept). [V] No job API exists in RFC-0007 or RFC-0007-A1. RFC-0010 §19.4 already flagged the `max_duration_hint` sub-gap. |
| H5 | HIGH | Events consumed but never produced/registered: `policy.*` and `skill.registry.updated` | `policy.updated` consumed by RFC-0011 §4, RFC-0012 §6.4 ("cache invalidation is event-driven"), RFC-0014 §9, RFC-0010 §12.3/§14.3 — but `policy.*` is still "reserved, unowned" (RFC-0006 §3.3) and absent from the RFC-0006-A1 R1 registry. [V] `skill.registry.updated` is consumed by RFC-0011 §4 and RFC-0012 §4 but RFC-0002 §13.1 emits no such event (its names are `SkillValidated`, `SkillUpgraded`, …) and `registry.*` is likewise unregistered in RFC-0006-A1. Four subsystems' cache-invalidation designs depend on events that have no producer contract. |
| H6 | HIGH | The A1 amendment pack **over-claims three grants it never made** (learning wiring) | RFC-0014-A1 R2 states the RFC-0001 skill-ranking read path, RFC-0011 parameter reload, and RFC-0012 routing-weight scoring were "granted by RFC-0001-A1, RFC-0011-A1 R5, RFC-0012-A1 R2". [V] None of those amendments mentions the Parameter Store, rankings, or routing weights. The hooks exist in the base RFCs (RFC-0001 §8.2 `historicalSuccessBonus`, §15; RFC-0011 §18.4 pinning; RFC-0012 §11.1 scoring) but the wiring amendments were never written — the pack reproduced, in miniature, the phantom-grant disease it was created to cure. |
| H7 | HIGH | Escalation has no interim resolution semantics | RFC-0003 §5.3/§18.2(3), RFC-0005 §18.2/§18.7, RFC-0006 §14.2 all defer the resolution owner to future RFC-0021 — but no interim behavior exists: an `ESCALATE`d node parks the execution in `Blocked`/`PAUSED` **indefinitely** (RFC-0005 §12.3 explicitly refuses to assign timeout action). Unacceptable for autonomous workflows in Phase 1, which precedes RFC-0021. |
| M1 | MEDIUM | Continuous-evaluation `DENY` → cancellation has no authorized principal | RFC-0003 §6.4 ("triggers the Executor to halt the in-flight node… out of this RFC's scope") vs RFC-0008 §7.2/§13.6 (Cancel is the most-sensitive command, "requires authorization against the target's causation tree"). The Policy Engine is not defined as a cancel-authority principal. |
| M2 | MEDIUM | Tool Runtime claims RuntimeState mutation rights not granted | RFC-0012 §4 (RFC-0005: "invocation state… is visible in the Runtime State as part of the execution's resource profile") vs RFC-0005 §12–§13 mutator tables, which name only Scheduler, Executor, and the framework. [V] No amendment grants Tool Runtime a state-domain record type. |
| M3 | MEDIUM | `cancellationState.requested` mutation path for Executor-relayed cancels undefined | RFC-0008 §7.2/§11.6 (Executor journals and acts on Cancel commands) vs RFC-0005 §3.7/§13.3 (Executor "never sets `requested` itself"; only external/Scheduler may). Who writes the flag when an operator calls `Executor.Cancel` is unspecified. |
| M4 | MEDIUM | Duplicate artifact type: `Checkpoint` (RFC-0004 §5.12) vs `RuntimeStateSnapshot` (§5.11) | RFC-0005 §9.1 declares "a checkpoint **is** a RuntimeStateSnapshot artifact", making §5.12's separate `Checkpoint` type redundant/dead. [V] RFC-0004-A1 does not address the duplication. |
| M5 | MEDIUM | RFC-0005 §18.6's required formal adoption of its typed `RuntimeStateSnapshotPayload` over RFC-0004 §5.11's provisional typing was never issued | Self-flagged in RFC-0005 §18.6; not covered by RFC-0005-A1. |
| M6 | MEDIUM | `Prompt`/`Completion`/`ModelOutput` artifacts have no legal producer path | RFC-0005 §7.5 denies node code any artifact-write handle (propose-not-write); RFC-0004 §5.7–5.9 name producers as "any skill invoking a model". Only the framework may create artifacts, but no RFC says the Executor materializes model-call records from InvocationContext telemetry/streams. |
| M7 | MEDIUM | `executor.*` event names not normalized | RFC-0008 Appendix C types (`execution.admitted`, `attempt.started`, `lease.acquired`, …) lack the domain prefix required by RFC-0006-A1 R1/R2; the registry row says "normalized to grammar" but no alias table exists. [V] |
| M8 | MEDIUM | Obligation-kind registry unowned | RFC-0003-A1 R3 defines `Obligation = { kind: string (namespace-registered) }` but no RFC owns the obligation-kind registry or its enforcement-point bindings (budget→Resource Coordinator, redaction→Stream Manager, rate-cap→Tool Runtime are scattered across RFC-0007 §9.2, RFC-0008 §6.5, RFC-0012 §6.6). |
| M9 | MEDIUM | `scheduler.resource.unavailable` consumed but undefined | RFC-0011 §4 subscribes it; neither RFC-0007 nor RFC-0007-A1 R5 defines it. |
| M10 | MEDIUM | Artifact encryption keys ("Kernel-managed key", RFC-0004 §11.4) have no owner | Neither reserved RFC-0017 (credentials) nor RFC-0022 (bootstrap/config) explicitly claims kernel data-key management. |
| M11 | MEDIUM | Policy path for skill-input artifact reads undefined | RFC-0005 §7.1 grants ExecutionContext a scoped `IArtifactQuery`, but the only access hook (RFC-0004-A1 R4 `callerContext`) is optional and trusted-caller-defaulting; nothing requires a policy consult when the framework hydrates artifact inputs for sandboxed skill code. |
| M12 | MEDIUM | Duplicated retry accounting | RFC-0007 §2 (Task `attempt count`) vs RFC-0008 §8.1 (`attemptCounter`). Post-H3 resolution these must reconcile or one becomes derived. |
| L1–L7 | LOW | (a) `ModelOutput`, `Warning`, `Documentation`, `ArchitectureFinding` artifact types have no named consumers (RFC-0004 §5.9/§5.14/§5.17/§5.16); (b) `memory.*` events have only observational consumers (RFC-0010 §8.6); (c) `correlationId` defined as executionId "or equivalent" (RFC-0006 §2.2); (d) audit query coupled to `IPolicyEngine` (RFC-0003 §14); (e) per-subscription durable buffers multiply storage (RFC-0006 §7.2); (f) full-snapshot quiesce <100ms (RFC-0010 §16.4, self-mitigated §20.6); (g) Executor's prepare-time `Resolve` should be pinned as a lookup, not re-selection (RFC-0008 §4.1/§11.3). |
| F1–F9 | FUTURE | Reserved-RFC tracks: 0016 ledger accounting, 0017 identity/principals, 0018 model registry, 0019 session, 0020 sandbox mechanism, 0021 escalation owner, 0022 bootstrap/ingress, 0023 plugin distribution, 0024 data sovereignty (RFC-0000 §8). Not blockers for Phase 1; blockers for their dependent phases. |

**Phase-1 verdict on subsystem validation:** every subsystem has ownership, responsibilities, interfaces, lifecycle, and feasible implementation *except* where the register above says otherwise. No duplicated responsibility remains at the boundary level (Phase 0 closed those); the remaining duplication is *inside* seams (H1, M4, M12). No circular runtime dependencies (Phase 2). No impossible implementations found beyond H2's "unimplementable as-written" predicate vocabulary (fail-closed would brick the catalog) and H4's missing job API.

---

## Phase 2 — Dependency Graph Validation

Walked every RFC header + text against the canonical graph (RFC-0000 §3).

**Cycles:** none in runtime edges. The 0007↔0008 pairing is runtime(0007→0008) + type(0008→0007, Order contract) — legal under RFC-0000 §3's edge rules. The former 0001↔0005 cycle is type-only. ✅

**Phantom dependencies (remaining):**
- P-1 (HIGH → H5): `policy.updated` and `skill.registry.updated` are phantom producer dependencies of RFC-0010/0011/0012/0014 cache-invalidation designs.
- P-2 (MEDIUM → M2): RFC-0012 §4's RuntimeState "resource profile" contribution is a phantom write dependency.
- P-3 (LOW): RFC-0003 §9.1 `context.ledger` — the *data path* is defined (RFC-0005 §11.1: assemble from `resourceUsageReference`), but cross-execution accounting awaits RFC-0016; acceptable interim, note for CostPolicy implementers that `spentSoFar` is execution-scoped until 0016 lands.

**Undocumented dependencies (remaining):**
- U-1 (HIGH → H4): RFC-0010/0013/0014/0015 depend on a Scheduler job-registration interface that RFC-0007 does not document.
- U-2 (MEDIUM → M6): RFC-0004 §5.7–5.9 depend on an Executor telemetry-materialization behavior that RFC-0008 does not document.
- U-3 (MEDIUM → H6): RFC-0014 depends on read/reload wiring in RFC-0001/0011/0012 that their amendments do not document.

**Future-RFC-required-by-earlier-RFC (rule violation, accepted with conditions):**
- RFC-0003 §5.3 (ESCALATE) requires future RFC-0021 → **violates the rule with no interim** (H7). Condition: A2 interim semantics (see Schedule B).
- RFC-0002 §14.5 (sandbox mechanism) requires future RFC-0020 → violates the rule, **but** Phase-1 scope (prompt-only skills, `entryPoint: SKILL.md`, `local` trust, empty `permissions`) never exercises code loading; documented condition: sandbox contract mandatory before any code-bearing skill or plugin root. Accepted.
- RFC-0004 §11.4 (encryption keys), RFC-0003 §17 (principals) → RFC-0017/0022 tracks; Phase-1 single-tenant interim (opaque local principal, process-bound keys) recordable as ADRs. Accepted.

**Subsystem-depending-on-implementation-details:** none found — all dependencies target contracts (interfaces, schemas, event vocabularies). ✅

---

## Phase 3 — Interface Audit

Full inventory audited (28 public interfaces across 15 RFCs). Ownership is now single per interface (Ownership Matrix, `docs/phase-0/04`). Findings:

1. **Duplicate interfaces:** none remaining post-reconciliation. `IExecutionRuntime` (RFC-0007 §11) is properly superseded by adoption (RFC-0007-A1 R2) — recorded, not duplicated.
2. **Overlapping interfaces:** three query families (RFC-0004 §9.5, RFC-0012 §7.5, RFC-0013 §7.3, RFC-0015 §7) — distinct stores, distinct owners: acceptable, LOW (name-collision hygiene only). Retry-decision overlap is single-owner (RFC-0003 §7.8) with three mechanical layers — documented (RFC-0007-A1 R6). ✅
3. **Hidden contracts:**
   - HC-1 (HIGH → H2): RFC-0001 §13's "fixed, small predicate grammar over **named RuntimeState fields**" — the field set is a hidden contract with no owner. Worst single finding in the audit.
   - HC-2 (MEDIUM → H5): cache-invalidation events assumed by three subsystems.
   - HC-3 (MEDIUM → M8): obligation-kind enforcement bindings.
   - HC-4 (LOW → L-g): RFC-0008 §4.1's prepare-time resolution reads as re-selection; must be pinned lookup of the plan's `(skillId, version)`.
4. **Multiple responsibilities:** `IPolicyEngine` mixes evaluation + audit query (RFC-0003 §14) — LOW. `EventBusClient.publish` is both ingestion and (via §5.3 dedup) producer-idempotency service — acceptable, documented.
5. **Impossible/infeasible interfaces:**
   - RFC-0010 §7.6 `MemorySnapshot(FULL)` with <100ms cross-tier quiesce — infeasible at scale as a hard bound; self-mitigated by §20.6 and RFC-0010-A1 R3 phase subset. LOW.
   - RFC-0014 §11.5 Shadow Evaluator requires offline replay of subsystem decision logic — feasible *only because* of the determinism doctrine; requires the replay harness as a first-class Phase-3 deliverable. MEDIUM feasibility note, not a defect.
   - RFC-0006 §6.2 publish + RFC-0004 §10 audit-trail dual-write — sound under at-least-once + `eventId` dedup (RFC-0006 §5.3). ✅

**Mutation rules, versioning, compatibility:** every mutating interface is CAS/propose-commit/idempotent-command based; versioning via schema registry (RFC-0004 §7), policy snapshots (RFC-0003-A1 R4), manifest semver (RFC-0002 §3.2). No interface lacks a stated mutation discipline. ✅

---

## Phase 4 — Complete Runtime Trace

Trace: **Goal → Resolver → Policy → Artifacts → State → Bus → Scheduler → Executor → Reflection → Completion.** Ownership transfer verified at every hop.

| # | Step | Owner | Contract | Verdict |
|---|---|---|---|---|
| 1 | Goal ingress; `UserIntent` artifact created; Resolver invoked | **Undefined** — "kernel orchestration layer above both, out of this RFC's scope" (RFC-0003 §9.1); reserved RFC-0022 | RFC-0004 §5.18 (UserIntent) | ⚠️ MEDIUM: Phase-1 interim = kernel `main` composition + ADR; full contract at RFC-0022. Not undefined *behavior* (artifact + call are specified) — undefined *component*. |
| 2 | `resolve(Goal, registry, state)` → `ExecutionPlan` | Resolver | RFC-0001 §3 | ✅ — **except H2**: `RuntimeState` input assembly (45-variable vocabulary) has no owner; `availableArtifacts` maps to `currentArtifacts` (RFC-0005 §10.2) but the rest is unmapped. |
| 3 | ExecutionPlan artifact written (parent: UserIntent) | Resolver | RFC-0004 §5.1 | ✅ |
| 4 | `evaluatePlan` per node → `PolicyDecision`s | Policy Engine | RFC-0003 §6/§8; Decision artifact per RFC-0004 §5.4 | ✅ — obligations (M8) and version pinning (RFC-0003-A1 R4) in order. |
| 5 | Plan accepted; `RuntimeStateManager.create()`; state domain allocated | Scheduler (creator) | RFC-0005 §5.1/§12.2 | ✅ |
| 6 | `StatusTransitioned`, `ArtifactCreated` published | State/Artifact producers | RFC-0006 §3.2 (registry per 0006-A1 R1) | ✅ |
| 7 | Tasks → reservations → **Orders** → `Executor.Dispatch` | Scheduler | RFC-0007-A1 R2 + RFC-0008 §7.1 | ✅ — **except H3** (re-dispatch identity) and H1 (which status machine is authoritative for this execution). |
| 8 | Admission (idempotent) → prepare (pinned resolve+load, PEPs) → attempts → streams | Executor | RFC-0008 §6/§9/§11 | ✅ — M6 (model-call artifact materialization), L-g (pinned lookup wording), M1 (continuous-DENY cancel principal). |
| 9 | Outcome: `ExecutionResult` + manifest artifact; terminal CAS; terminal event | Executor Finalizer | RFC-0008 §6.8/§11.11; RFC-0004 §5.2 | ✅ |
| 10 | Completion signal → task COMPLETED → dependency decrement → plan completion → state terminal → checkpoint → Archived | Scheduler + State | RFC-0007 §5.2; RFC-0005 §5.6/§5.8 | ✅ |
| 11 | `scheduler.execution.completed` → Reflection session → `ReflectionArtifact` + Lessons → Memory | Reflection Engine | RFC-0013 §6.1/§9.2 (trigger now real per RFC-0007-A1 R5) | ✅ |
| 12 | Learning consumes reflections on 6–48h cycles; parameters reload via `learning.update.applied` | Learning Engine | RFC-0014 §9 | ⚠️ **H6**: reload wiring in 0001/0011/0012 absent. |
| 13 | Result surfaced to user | Kernel orchestration | lineage UserIntent → ExecutionResult | ⚠️ same as step 1. |

**Undefined behaviors found in trace:** H2 (step 2), H3/H1 (step 7), M1/M6 (step 8), H6 (step 12), ingress/egress component (steps 1/13), H7 if any node ESCALATEs mid-plan. **Everything else transfers ownership cleanly with no orphaned or double-owned data.**

---

## Phase 5 — Artifact System Validation

Checked every artifact type in RFC-0004 §5 plus later-registered types (RFC-0008 §8.4 segments/manifest; RFC-0011 §7.10 Plan Artifact; RFC-0012 §8.8 InvocationRecord; RFC-0013 §8.1 ReflectionArtifact; RFC-0014 evidence/proposal/snapshot; RFC-0015 debug bundle; RFC-0010 §7.6 memory snapshots).

- **Orphans/dead types:** `Checkpoint` (M4 — duplicate of RuntimeStateSnapshot, must be deprecated); `ModelOutput`, `Warning`, `Documentation`, `ArchitectureFinding` (no named consumers — L1; acceptable as queryable audit classes, but register a consumer or mark "audit-terminal" in the schema registry). Skill-pack side: 17 produced types with no in-pack consumer (`ReviewVerdict` ×3 producers / 0 consumers) — already tracked (`docs/phase-0/06` §3) as Phase-1 skill-graph work. **No kernel-produced type is entirely unconsumed except the four above.**
- **Duplicate definitions:** one (M4). Plan Artifact vs ExecutionPlan artifact are properly distinct post-RFC-0011-A1 R1. ✅
- **Circular production:** none — lineage is DAG-by-construction (RFC-0004 §8.2); verified the one subtle path: Planner consumes Reflection lessons via *Memory*, not via artifact parent edges (WorldStateSnapshot is embedded content, not a parent), so no reflection→plan→execution→reflection artifact cycle exists. ✅
- **Inconsistent schemas:** M5 (RuntimeStateSnapshotPayload typing adoption) and M6 (Prompt/Completion producers) — both Schedule-B fixes. Otherwise payload ownership is now single (owning RFC registers schema per RFC-0004-A1 R2 / RFC-0006-A1 R1). ✅

**Corrections recommended:** Schedule B items B4 (dedupe Checkpoint), B5 (adopt typed snapshot payload), B6 (Executor materializes Prompt/Completion/ModelOutput from telemetry frames), plus registry "audit-terminal" class for L1 types.

---

## Phase 6 — Event Bus Validation

| Namespace | Producer | Consumers | Verdict |
|---|---|---|---|
| `artifact.*` | RFC-0004 | 0007, 0010, 0012, 0013, 0015 | ✅ |
| `runtimestate.*` | RFC-0005 | 0007, 0015 (+0013 indirect) | ✅ |
| `scheduler.*` | RFC-0007 (via A1 R5) | 0011, 0012, 0013, 0014, 0015 | ⚠️ topics named, **payload schemas unwritten** (G1 work); M9 (`scheduler.resource.unavailable` undefined) |
| `executor.*` | RFC-0008 | 0007 (observation), 0013, 0015 | ⚠️ M7 (App C names lack domain prefix; no alias table) |
| `memory.*` | RFC-0010 | 0015 only (observational) | LOW (b2) |
| `planner.*` | RFC-0011 | 0013 | ✅ |
| `tool.*` | RFC-0012 | 0013, 0015 | ✅ |
| `reflection.*` | RFC-0013 | 0014 | ✅ |
| `learning.*` | RFC-0014 | 0001/0011/0012 (reload — **unwired**, H6) | ⚠️ |
| `observability.*` | RFC-0015 | internal | ✅ |
| `registry.*` / skill lifecycle | RFC-0002 §13.1 emits (CamelCase) | 0011, 0012 consume `skill.registry.updated` | ❌ **H5**: namespace unregistered, name mismatch, producer↔consumer never reconciled |
| `policy.*` | none (RFC-0006 §3.3 "reserved") | 0010, 0011, 0012, 0014 consume `policy.updated` | ❌ **H5**: consumed event with no producer |
| `escalation.*` | none (reserved) | none | ✅ correctly reserved |

**Payload/naming/lifecycle consistency:** grammar + alias mechanism exist (RFC-0006-A1 R2) but the alias table covers only `memory.*` and artifact CamelCase; `executor.*` (M7) and `registry.*` (H5) normalizations are missing. Lifecycle consistency: at-least-once + ordered-per-key is uniform across all consumers' stated assumptions. ✅ (post B-fixes)

---

## Phase 7 — Runtime State Validation

- **Multiple writers:** designated-mutator model (RFC-0005 §12–§13) is sound; **one violator** (M2: Tool Runtime). CAS per record + `domainRevision` (RFC-0005-A1 R2–R3) gives serializable-per-record and snapshot-consistent domains. ✅ after B-fix.
- **Conflicting ownership:** **H1** — the root ExecutionState `currentStatus` and the Executor's `ExecutionRecord.status` are two authoritative-looking truths for one fact with different vocabularies (verified: zero overlap even in naming convention). Must declare one authoritative and one derived/view.
- **Race conditions:** CoW views (§14.2), set-union appends (§8.3), crash-window reconciliation (§9.6, fail-closed `crashed`) — all defined. The one unguarded race: M3 (cancellation flag writer). H3 (re-dispatch) creates a state-lineage race (two state domains for one logical task attempt chain) — resolved with H3.
- **Duplicated state:** H1 (status), M12 (retry counters), and `currentArtifacts` vs ExecutionRecord `resultSet` — distinct scopes (working set vs final result), acceptable. ✅
- **Stale state:** TTL/LRU + checkpoint-walkback defined; CoW staleness semantics documented (§14.2). ✅
- **Unnecessary persistence:** none found; checkpoint cadence is node-boundary and full-payload is optional (§9.3). ✅
- **Synchronization:** watch/lease primitives now owned (RFC-0005-A1 R4) with fencing (RFC-0008 §11.7). ✅

---

## Phase 8 — Policy Engine Validation

Coverage matrix (decision → policy instrument): skill invocation ✓ (Security/Permission, RFC-0003 §7.1–7.2); permissions ✓; security ✓; confidence ✓ (§7.6, enforced escalation); token budgets ✓ (ContextPolicy §7.4 + Order budget ceilings → reservations, RFC-0007 §9.2); execution cost ✓ (CostPolicy §7.3); retry ✓ (§7.8, PEP-bound at RFC-0008 §6.5); escalation ✓ (outcome; resolution gap H7); evidence ✓ (§7.5); user approval ✓ (userOverrides §17.3 + ESCALATE); resource limits ✓ (reservation caps + RFC-0012 §6.6 quotas, policy-sourced); memory ops ✓ (RFC-0010 §6.1); tool invocation ✓ (RFC-0012 §6.4); learning application ✓ (RFC-0014 §13.3); observability queries ✓ (RFC-0015 §6.1).

**Bypasses identified:**
1. **B-1 (MEDIUM → M11):** framework-mediated artifact reads for sandboxed skill inputs have no mandatory policy consult (optional `callerContext` defaults open for trusted callers). Fix: B10.
2. **B-2 (MEDIUM, accepted):** prompt-defined skills (`entryPoint: SKILL.md`) have no skill-level sandbox — their effective authority is the session's, gated only downstream at Tool Runtime/PEPs. Acceptable for Phase-1 (`local` trust, empty `permissions`); becomes a hard rule at RFC-0023 (plugin distribution) — record as condition.
3. **B-3 (LOW):** kernel-internal store operations (tier migration, GC, index rebuild) are deliberately ungoverned (RFC-0004 §1.3) — documented, accepted.
4. **B-4 (LOW):** policy cache TTLs (5s/60s/120s across RFC-0003 §3.8, RFC-0010 §14.3, RFC-0012 §6.4) create a bounded revocation lag window — each justified locally; a single corpus-wide statement of worst-case revocation lag should be added to the RFC-0003-A1 compatibility note (Schedule B, B11).

**Verdict:** no ungoverned decision on the execution path other than B-1/B-2 above. The "everything fails closed on Policy" correlated-outage concern from the 2026-08-20 review remains **unmitigated by design** (availability posture), acceptable for Phase 1 single-node; revisit at RFC-0016/0022.

---

## Phase 9 — Scheduler / Executor Review

Canonical split (Ownership Matrix; RFC-0007-A1 R4): *Scheduler owns when/where/order (queues, fairness, reservations, dependency satisfaction); Executor owns how/whether (admission, attempts, execution-side cancellation, monitoring, feedback).*

Note: the review brief's example allocation ("Scheduler owns leases") is **not** the canonical allocation — leases are Executor-owned (RFC-0008 §11.7 on RFC-0005-A1 R4 primitives), because a lease is execution-time write ownership; the Scheduler holds pre-dispatch *Reservations* (RFC-0007 §8.2). The board validates the canonical split: it is the only one consistent with fencing and with RFC-0005's mutator tables.

**Overlaps found:**
1. **H1** — status truth split across both (see Phase 7).
2. **H3** — retry/redispatch identity spans both.
3. **M12** — attempt counters in both.
4. **M1** — continuous-DENY cancel crosses both without a principal.
5. Cancelled-children semantics: RFC-0008 §11.6 cascade is event-driven with a documented `cascadeIncomplete` window (§18.5) — accepted, surfaced.
6. RFC-0007 §3.10 Retry Manager vs RFC-0008 §11.4 attempt loop: correctly layered post-RFC-0007-A1 R6 (policy decides; mechanics per layer) — no double-retry *decision*, only the accounting duplication (M12).

**Verdict:** separation is real and enforceable once Schedule B lands; no responsibility exists that both own after fixes.

---

## Phase 10 — Skill System Validation

Mechanically validated (post-Phase-0 repair), against RFC-0002 §3.2 + A1:

- **Required fields:** `id` ✓ (30/30, equals `name`, grammar-conformant), `version` ✓ (strict semver `2.0.0`), `name`/`description`/`priority` ✓, `entryPoint` ✓ (`SKILL.md`, prompt-skill convention per RFC-0002-A1 R2).
- **Optional-but-checked fields:** `permissions` absent → defaults `[]` (legal; all 30 skills are prompt-defined and request no capabilities — consistent with B-2 acceptance); `capabilities` absent → defaults `[]` (**recommend adding tags** — the Capability Index (RFC-0002 §8) is otherwise empty for the whole catalog; minor improvement, not a violation); `checksum`/`signature` N/A at `local` trust (required at `local-verified`+ — condition recorded).
- **Dependency graph:** `requires` edges: model-router→task-decomposer, cavecrew→task-decomposer, architecture-review→repository-map, ponytail-debt→ponytail-audit, ponytail-gain→ponytail-debt. **Acyclic** ✓; all targets resolve ✓; `exclusiveWith` symmetric ✓ (post-fix); escalate-to-exclusive targets legal per RFC-0001-A1 R3 ✓.
- **Invalid manifests:** none (all 30 validate at `local` trust). [V]
- **Unused/unreachable skills:** none structurally unreachable — every skill is predicate-triggered; **but H2 makes reachability vacuous**: with fail-closed predicate evaluation and no registered variable set, formally *every* skill is unreachable until B2 defines the vocabulary. This is why H2 is the top-priority amendment.
- **Inconsistent naming:** eliminated in Phase 0 (dirs == ids). ✓
- **Open graph semantics (tracked, not blocking manifests):** 17 produced artifact types without in-pack consumers (`ReviewVerdict` most important); 11 consumed-without-producers are legitimate external inputs (now documented, `docs/phase-0/06` §3).

---

## Phase 11 — Kernel Boot Validation

Final boot order with rationale (interim owner: kernel bootstrap per reserved RFC-0022; record as ADR-0001 at implementation):

```
0  Kernel bootstrap        config load, DI wiring, shutdown hooks     (RFC-0022 interim/ADR)
1a Event Bus               no upstream; enables all lifecycle events  (RFC-0006)
1b Skill Registry&Loader   no upstream; emits RegistryReady via 1a    (RFC-0002 §2.3)
   ── parallel wave {1a,1b}: Registry's events buffer via its audit-trail
      fallback (RFC-0002 §4.6/§13 analogue to RFC-0004 §10) if 1a lags ──
2  Artifact System         needs 1a (§10 events; audit-trail fallback);
                            storage backend self-contained            (RFC-0004)
3  Runtime State           hot store independent; checkpoints need 2  (RFC-0005)
4  Policy Engine           validation pipeline shape reuses 1b's
                            primitives; reads manifests lazily;
                            BOOT_FAILED without criticals             (RFC-0003 §16.1)
   ── parallel wave {2,3,4} ──
5  Resolver                needs 1b (registry); reads 3              (RFC-0001)
6  Executor                needs 1a,1b,2,3,4,5 (PEPs, pinned resolve)(RFC-0008)
   ── parallel wave {5,6} ──
7  Scheduler               needs 3,4,6 (dispatch target must be ready)(RFC-0007)
8  Memory · Tool Runtime   register background jobs with 7; episodic
                            writes degrade gracefully                 (RFC-0010/0012)
9  Planner                 needs 1b,2,3,4,8 (memory)                 (RFC-0011)
10 Reflection · Learning · Observability   subscribe last; replay from
   "earliest" within retention to backfill                              (RFC-0013/14/15)
```

**Why each edge exists:** 1b→(2,4,5,6) registry data/validation reuse; 2→3 checkpoint artifacts; 3→(5,6,7) state reads/domains; 4→(6,7) decisions; 6→7 nothing dispatches until something can execute; 7→8 job registration (H4 API required); 8→9 planner estimates read memory; 10 last because it is purely event/artifact-driven and must not slow the execution path (RFC-0013 §12.1).

**Parallelization opportunities:** waves {1a,1b}, {2,3,4}, {5,6} as marked — ~4 sequential depth levels instead of 11. Shutdown is reverse order (Observability first, bus last, flush durable logs).

**Boot-time violations found:** H4 (no job API for step 8), H5 (RegistryReady/`skill.registry.updated` namespace unreconciled — step 1b's events), M7 (executor event normalization — step 6).

---

## Phase 12 — Implementation Readiness Scores

| Dimension | Score | Justification |
|---|---|---|
| **Architecture** | **7.5/10** | Sound organs, clean boundaries, real invariants (determinism, fail-closed, propose-not-write). Docked: dual status truth (H1), variable vocabulary (H2), unowned registries (H5/M8) at the seams. |
| **Consistency** | **8/10** | From 2/10 pre-Phase-0 to 8: one plan contract, one dispatch contract, one policy enum, ownership matrix. Docked for the A1 pack's own three phantom grants (H6) and the residual event-name gaps (H5/M7). |
| **Modularity** | **8/10** | Layered L0–L9 with legal type-vs-runtime edge rules; every RFC replaceable behind its interface. Docked: obligation enforcement scattered across three subsystems (M8). |
| **Performance** | **6/10** | Targets are stated and mostly plausible (cold boot <1s@1k skills; plan-time policy <20ms; dispatch <10ms), but zero are measured; policy-on-everything and Scheduler single-write-path (RFC-0007 §18.1.2, self-flagged) remain the top risks. Determinism machinery (jitter, replay) is overhead priced in voluntarily. |
| **Security** | **7/10** | Fail-closed is a named, repeatedly-applied invariant; trust levels, signatures, fencing, redaction-at-egress, governed self-modification. Docked: sandbox mechanism (RFC-0020) and identity (RFC-0017) unimplemented tracks; B-1/B-2 bypasses; audit tamper-resistance deferred (RFC-0003 §18.2). |
| **Scalability** | **6.5/10** | 10k-skill Registry design is genuinely strong; sharded Executor has no global hot spot; distributed execution remains *intent with extension points* (RFC-0007 §18.1.3 admits this); reflection throughput (86/min) and event volume are flagged by their own RFCs. |
| **Developer Experience** | **5.5/10** | Excellent entry point, ledger, glossary, synonym map, per-RFC test sections; but no schemas yet (G1), no CI, no runnable anything. The corpus reads well and runs nothing. |
| **Implementation Readiness** | **6.5/10** | Build order, gates, conformance fixture (skill pack), and unambiguous interfaces exist; blocked from higher by H2 (Resolver input), H1/H3 (L5 seam), H4 (platform jobs). All fixable by paper within one amendment cycle. |
| **Production Readiness** | **3.5/10** | Zero code; reserved roots (0016/0017/0020) mandatory before enterprise; distributed/multi-tenant undesigned (by deliberate deferral). Correct for this stage of the project. |

---

## Phase 13 — Remaining Gaps (ranked)

**Blockers (by phase):**
1. **Amendment Schedule B** (this review) — blocks G0 completion and Stages 1b/5/8 as itemized.
2. **RFC-0016 Resource Manager & Execution Ledger** — blocks Phase 2 (CostPolicy cross-execution accounting, quotas/placement; RFC-0003 §9.2, RFC-0007 §8, RFC-0008 §3). Interim data path exists (RFC-0005 §11.1) — Phase 1 unblocked.
3. **RFC-0017 Identity & Credential Store** — blocks multi-user/enterprise and RFC-0008 §13.1 credential handles. Phase 1 unblocked (opaque local principal, ADR).
4. **RFC-0020 Sandbox Enforcement** — blocks any code-bearing skill/plugin. Phase 1 unblocked (prompt-only pack).
5. **RFC-0022 Kernel Bootstrap & Configuration** — owns goal ingress/egress composition (Phase-4 trace steps 1/13) and boot order formalization. Phase 1 interim: ADR-0001.
6. **RFC-0021 Escalation/HITL** — blocks autonomous (unattended) operation beyond Phase 1; interim semantics required now (H7/B7).

**Optional enhancements (defer):** RFC-0018 Model Registry (interim: `model-router` skill), RFC-0019 Session (session-scope variable expiry — RFC-0005 §18.9), RFC-0023 Plugin distribution, RFC-0024 Data sovereignty (enterprise compliance gate, not kernel gate). Plus L-class items and the Phase-1 skill-graph work (ReviewVerdict consumers).

---

## Phase 14 — Implementation Roadmap (no new RFCs)

**Order** (identical to `docs/phase-0/10`, amended for co-tested L5):

```
G0  Ratify A1 pack + Schedule B (A2 amendments)      [paper]
G1  schemas/  — manifest, artifact envelope+taxonomy, event envelope+
    registry (incl. scheduler.*/registry.*/policy.*/executor.* payloads),
    policy decision/request, ExecutionState + variable registry   [paper→code]
S1  kernel: registry → resolver                       (fixture: skills/agy-skills-v2)
S2  kernel: policy
S3  kernel: artifact → runtime-state
S4  kernel: event-bus
S5  kernel: executor ⇄ scheduler  (co-developed; joint contract tests)
G8  end-to-end demo: goal→…→artifact, kill -9 mid-plan, resume
P2  memory(phase-1 tiers) → tool-runtime   (needs H4 job API)
P3  planner → reflection → learning → observability
```

**Language:** **TypeScript** (Node 22 LTS, strict). Rationale: the entire contract surface is JSON/YAML/ULID/schema-shaped; first-class async I/O for the bus/store/sandbox boundaries; the skill pack is markdown-centric (tooling parity); determinism is enforceable via lint + injected clock/ID providers; team velocity for a specification-heavy kernel. **Rust** remains the right choice later for the two hot paths if measurements demand it (event-bus log, artifact checksum/spool) — behind the same interfaces, per ADR.

**Repository layout (monorepo, pnpm workspaces):**

```
agy/
├── packages/
│   ├── kernel-core/            # RFC-0000 invariants: IDs, clock, DI, fail-closed helpers
│   ├── kernel-registry/        # RFC-0002 (+A1) — discovery, validation, indices, loader
│   ├── kernel-resolver/        # RFC-0001 (+A1/A2) — matcher/ranker/solver/builder
│   ├── kernel-policy/          # RFC-0003 (+A1/A2)
│   ├── kernel-artifact/        # RFC-0004 (+A1/A2)
│   ├── kernel-state/           # RFC-0005 (+A1/A2) — domains, CAS, watch, leases
│   ├── kernel-eventbus/        # RFC-0006 (+A1/A2)
│   ├── kernel-scheduler/       # RFC-0007 (+A1/A2) — queues, jobs API (B8)
│   ├── kernel-executor/        # RFC-0008 (+A1/A2) — control plane + invocation runtime
│   ├── platform-memory/        # RFC-0010 (phase-1 tiers)     [Phase 2]
│   ├── platform-tools/         # RFC-0012                     [Phase 2]
│   ├── cognition-*/            # planner, reflection, learning, observability [Phase 3]
│   ├── skills/                 # skill-pack tooling: frontmatter lint, manifest generator
│   └── testing/                # determinism harness, golden suites, fixtures, 10k-skill generator
├── skills/agy-skills-v2/       # unchanged (fixture)
├── schemas/                    # G1 output (authoritative once RFCs Accepted)
├── docs/                       # unchanged (rfcs, amendments, adr, phase-0, architecture)
├── examples/
└── tests/                      # cross-package integration (G8 scenario)
```

**Package boundaries:** one package per RFC, one file per RFC §"Public Interfaces"; packages export *only* those interfaces + types (enforced by `api-extractor`/`ts-api-lint` in CI); cross-package imports of internals = CI failure — this mechanically enforces the Ownership Matrix.

**Testing strategy:** per-RFC suites as acceptance gates (each RFC's own §testing section is the checklist); property/fuzz tests where RFCs demand them (RFC-0002 §17.4, RFC-0001 §11.3, RFC-0003 §15.3); **determinism suite**: golden plans, golden decisions, dispatch-order replay, executor control-plane replay (bit-identical); chaos: crash injection at every durable-write point (RFC-0005 §16.5, RFC-0008 §17.3).

**CI/CD:** G-gates as required checks (G0 doc-lint → G1 schema-conformance → stage gates); lint = frontmatter/manifest reconciliation (productize Phase-0 scripts) + interface-export checks + no-`Date.now()`/no-`Math.random()` in `kernel-*` control-plane (determinism); CD: changesets → semver per package; kernel packages pin the RFC+amendment versions they implement in package metadata (`implementedContracts` field) — CI fails if an unimplemented amendment is marked implemented.

**Versioning & standards:** semver everywhere; RFC text is the contract, `schemas/` its machine form, packages its implementation — all three versioned in lockstep per amendment; coding standard: strict TS, DI-injected time/IDs/RNG, pure control-plane modules (no side effects — lint-enforced), propose-not-write patterns as typed wrappers, ADR required for any deviation from an RFC interface (deviation without ADR = CI red).

---

## Phase 15 — Final Sign-Off

# ✅ 2. READY WITH MINOR AMENDMENTS

The AGY architecture is **internally consistent, implementable, and approved for production kernel development**, conditional on one paper-only correction cycle. **No major architectural rework is required. No subsystem redesign is required.** Phase 0's reconciliation held: no CRITICAL findings exist; every issue discovered in this review is closable by additive amendment without touching an accepted decision.

**Conditions (all documentation; none require code):**

1. **Ratify the A1 amendment pack** (14 amendments) — unchanged.
2. **Issue Amendment Schedule B** (new `RFC-00NN-A2` files, enumerated below) and ratify **with** A1 at G0.

### Amendment Schedule B (required, with target stages)

| ID | Amendment | Resolves | Blocks stage | Resolution (spec for the A2) |
|---|---|---|---|---|
| B1 | RFC-0005-A2 / RFC-0008-A2 (joint) | H1, M12 | S5 | `ExecutionRecord.status` (RFC-0008 §10.1) is the **authoritative** execution status; RFC-0005 §4's root `currentStatus` becomes the **derived scheduler-view** with a normative bi-directional mapping table (e.g., `ADMITTED/PREPARING→Planning/Waiting`, `RETRY_WAIT→Retrying`, `FINALIZING→Running`, `DENIED/SKIPPED/TIMED_OUT→Failed`-subtypes, `CANCELLING→Blocked(reason=cancel)`); Task attempt counts (RFC-0007) become derived from Execution `attemptCounter`. |
| B2 | RFC-0005-A2 §2 (or RFC-0001-A2) | H2 | S1(Resolver), G1 | Define the **RuntimeState Variable Registry**: canonical names, types, owning producer, and derivation source for every predicate variable (RFC-0001 §3 fields + the 45 pack variables classified as: kernel-derived (`conversation_tokens`←ResourceUsage/token-budget report), skill-produced (`change_risk`, `subtask_risk` — declared `produces` on the assessing skills or ExecutionResult-derived), config/user (`cost_sensitivity`←user variables RFC-0005 §6.6), event-derived). Host: RFC-0005 schema extension; RFC-0002 validates against it; fail-closed (RFC-0001 §9) then has a defined closure. |
| B3 | RFC-0007-A2 + RFC-0008-A2 (joint) | H3 | S5 | Task re-dispatch after lease loss issues a **new Order** whose `orderId` references `(planId, stepId, attemptChainId, dispatchSeq)`; the new Execution's `parentExecution` (RFC-0005 §3.5) links the dead one; `executionId` derivation updated accordingly; Scheduler Task attempt count = Execution chain length. |
| B4 | RFC-0002-A2 §Scheduler Jobs | H4 | P2 | Add to RFC-0007 a minimal `ISchedulerJobs` API: `registerJob(spec{id, cron|interval, priority, maxDurationHint, idempotencyKey})`, lease-guarded single-instance execution per job id (mirrors RFC-0010 §16.3), events `scheduler.job.started|completed|failed`. |
| B5 | RFC-0002-A2 + RFC-0003-A2 + RFC-0006-A2 (joint, small) | H5 | G1 | Register `registry.*` (owner RFC-0002; alias table `SkillValidated→registry.skill.validated`, … and `skill.registry.updated→registry.skill.updated` aggregate) and `policy.*` (owner RFC-0003; `PolicyRegistered/Suspended/Unregistered→policy.set.updated` aggregate carrying changed policy ids) in the RFC-0006-A1 R1 registry; consumers normalize via aliases. |
| B6 | RFC-0001-A2 + RFC-0011-A2 + RFC-0012-A2 (the "learning wiring" A2s) | H6 | P3 (wire earlier harmlessly) | Wire the existing hooks: RFC-0001 §8.2 `historicalSuccessBonus` reads Skill Rankings from the Parameter Store (reload on `learning.update.applied`); RFC-0011 §18.4 session-init parameter pin reads Heuristics+Calibration sets; RFC-0012 §11.1 selection score adds the RoutingWeight term. Each is additive and defaults to identity when the store is absent. |
| B7 | RFC-0003-A2 §Escalation Interim | H7, M1 | G8 (unattended runs) | Until RFC-0021: an `ESCALATE`d node transitions to `Blocked` with `timeoutState.deadline` defaulting to a configured ceiling; on expiry the Policy Engine re-evaluates with `ESCALATION_TIMEOUT` context → `DENY` (fail-closed → reresolve) or `ALLOW`-with-`userOverrides` record. Continuous-DENY halts name the Policy Engine service principal as cancel authority (M1). |
| B8 | RFC-0004-A2 §types | M4, M5, L1 | S3 | Deprecate §5.12 `Checkpoint` (alias to `RuntimeStateSnapshot`); adopt RFC-0005 §9.2's typed payload formally (closes RFC-0005 §18.6); mark `ModelOutput`, `Warning`, `Documentation`, `ArchitectureFinding` as `audit-terminal` retention class (consumer: query/audit surface). |
| B9 | RFC-0008-A2 §events / §artifacts | M6, M7, L-g | S5 | Alias-normalize Appendix C to `executor.<object>.<verb>`; specify that the Executor materializes `Prompt`/`Completion`/`ModelOutput` artifacts from InvocationContext telemetry frames (framework-mediated, propose-not-write preserved); state that prepare-time `Resolve` is a pinned `(id, version)` lookup, never re-selection. |
| B10 | RFC-0005-A2 §mutations / RFC-0012-A2 §state | M2, M3, M11 | S3/S5 | Grant Tool Runtime a namespaced state-domain record `tool-invocations/{id}` (or relocate to InvocationRecords — prefer the latter); Executor is a designated mutator for `cancellationState.requested` **only** when relaying a policy-authorized Cancel (journal ref required); ExecutionContext's `IArtifactQuery` is scoped and **policy-consulted** via `callerContext` (B-1 closure). |
| B11 | RFC-0003-A2 §compat note; RFC-0006-A2 §storage note | M8, M10, L-class | with G1 | Obligation-kind registry owned by RFC-0003 (kind→enforcement-point binding table); kernel data-key management assigned to RFC-0022 scope (RFC-0017 for user credentials); worst-case revocation-lag statement; `correlationId` tightened to executionId or task/run id enumeration. |

**Explicitly not blocking:** all F-class reserved-RFC tracks (per Phase 13's interim rules), skill-graph consumer wiring (Phase-1 backlog), performance validation (measurement milestones in the build plan).

**Board instruction to the implementation team:** begin G0 (ratify A1 + issue Schedule B as A2 files) immediately; G1 schemas may proceed in parallel using Schedule B's specifications; the first code commit is authorized upon G0 completion. Deviation from any interface, however small, requires an ADR or amendment — never silent drift.

*End of Final Design Review.*
