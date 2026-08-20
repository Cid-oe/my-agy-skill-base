# AGY Repository-Wide Architecture Review

**Reviewer role:** Principal Systems Architect (10-year maintenance horizon)
**Date:** 2026-08-20
**Scope:** Every file in the repository (86 files, ~23k lines: 15 RFCs, 30-skill package, manifest, handoff, glossary, placeholders)
**Method:** Full read of all RFCs and skills, plus mechanical consistency checks (manifest↔disk reconciliation, exclusivity symmetry, artifact vocabulary closure, cross-RFC reference resolution)

**Evaluation legend used throughout:**
- **FACT** — verifiable from repository content (section/file cited)
- **INFERENCE** — logical conclusion drawn from facts
- **RECOMMENDATION** — proposed change, expressed as Amendment Proposal / Future RFC / Implementation Note. No accepted RFC text is rewritten anywhere in this review.

---

## 0. Governing Finding: The Corpus Is an Architecture-in-Fork

Before any per-subsystem scoring, one corpus-level fact dominates everything else in this review.

**FACT — Four authoring generations, each assuming a different universe:**

1. **RFC-0001 → RFC-0006** form one coherent lineage: sequential dependency chain, consistent vocabulary (fail-closed, determinism, propose-not-write), explicit cross-references that resolve correctly against each other.
2. **RFC-0007 (Scheduler)** explicitly states in §0 that it *could not see* RFC-0004/0005/0006, treats only RFC-0001–0003 as accepted, and refers to "RFC-0004: Execution Runtime" — a **numbering collision** with the actual RFC-0004 (Artifact System). Its `Depends on:` header lists only RFC-0001–0003.
3. **RFC-0008 (Executor)** states in Appendix A it "was designed without the published text of RFC-0001…0007 in hand" and assumes contracts that measurably differ from the published ones (detailed in §5 below). It also names the project "Artificial General Yield" (title block) versus "AI Operating System" everywhere else.
4. **RFC-0010 → RFC-0015** form a second coherent lineage among themselves, but RFC-0010 §"Dependency on RFC-0008 and RFC-0009" *assumes* "RFC-0008 defines model routing and RFC-0009 defines token budgeting (this is assumed, not confirmed)" — both false (RFC-0008 is the Executor; RFC-0009 does not exist).

**FACT — Status inconsistency:** The review brief says accepted RFCs are stable architecture. In the repository, **no RFC is marked Accepted**: RFC-0001–0007 say `Status: Draft`, RFC-0008 says `Draft for review`, RFC-0010–0015 say `Proposed` (verified by grep of all headers). Meanwhile RFC-0003+ headers describe their predecessors as "stable." The repository has no acceptance ledger, no RFC template, no numbering authority, and no process document.

**FACT — Future-RFC number collisions:** RFC-0010 suggests RFC-0011 = Memory Query Language (actual RFC-0011: Planner); RFC-0010 suggests RFC-0012 = Reflection Engine (actual: Tool Runtime; actual Reflection Engine is 0013); RFC-0010 suggests RFC-0014 = Right-to-Delete (actual: Learning Engine); RFC-0011 suggests RFC-0012 = Execution Monitor (actual: Tool Runtime) and RFC-0015 = Confidence Calibration (actual: Observability); RFC-0012 declares "RFC-0013 (Required): Credential Store" (actual RFC-0013: Reflection Engine). At least eight suggested numbers collide with already-occupied numbers or with each other.

**INFERENCE:** The repository is a merge of outputs from at least four separate design sessions that never had a shared view of the corpus. Each generation is internally disciplined and honest about its own assumptions, but the *seams between generations are unguarded*. The seams are exactly the load-bearing joints of an OS — the plan contract, the dispatch contract, the policy interface, the event model, the state model (see §5).

**RECOMMENDATION (blocking, before any implementation):** A corpus reconciliation pass — a single **RFC-0000A "Corpus Reconciliation & Status Ledger"** that (a) formally accepts/amends/rejects each RFC, (b) resolves the RFC-0007/RFC-0008 assumed-contract forks against the published RFC-0001–0006 text, (c) retires or assigns the RFC-0009 slot, and (d) establishes numbering authority for future RFCs. Nothing in the suggested build order (§11) should start before this exists.

---

## 1. Executive Summary

AGY set out to be an AI Operating System: a kernel (Registry, Resolver, Policy, Artifacts, State, Events, Scheduler, Executor), a skill ecosystem with declarative manifests, and a governance/learning loop (Memory, Reflection, Learning, Observability). Judged as **subsystem design**, the corpus is well above average: RFC-0001–0006 in particular show rare discipline — deterministic cores, fail-closed defaults applied as a system-wide invariant, explicit state machines, honest self-review sections, and repeated rejection of speculative abstraction.

Judged as **one operating system**, it does not yet hold together. Three forks split the architecture at its joints:

1. **Two planning pipelines.** RFC-0001 (Skill Resolver) turns goals into an `ExecutionPlan` DAG consumed by RFC-0007. RFC-0011 (Planner) turns goals into an `ExecutionGraph` DAG also consumed by RFC-0007 — using a different schema, a different selection model (HTN Methods stored in RFC-0002 manifests, which RFC-0002 does not support), and a different notion of skill choice. RFC-0011 §19.1 itself flags the schema must be reconciled with RFC-0007 "before either RFC moves from Proposed to Accepted."
2. **Two execution control planes.** RFC-0007 §11 specifies `IExecutionRuntime.dispatch/cancel/heartbeat` with Scheduler-granted leases; RFC-0008 specifies `Dispatch(Order)→Accept/Reject/Hold` with Executor-owned lease+fence, its own command journal, and cancellation semantics that contradict RFC-0007 §11.4 (fire-and-forget CANCELLED-on-issue vs cooperative grace-then-force).
3. **One policy engine, five incompatible client interfaces.** RFC-0003 defines `evaluateNode → ALLOW/DENY/MODIFIED/ESCALATE/DEFER` over a closed `IPolicyContext`. RFC-0008 assumes `permit/deny/obligate` + obligations + versioned policy snapshots; RFC-0010 needs `memory.*` attributes; RFC-0011 needs `PLAN_TIME` context and `PERMIT/DENY/CONDITIONAL`; RFC-0012 needs `tool.*` attributes and prefix matching; RFC-0014 needs `learning.*` attributes. Every one of these is an *acknowledged-but-unwritten* amendment to RFC-0003.

Meanwhile, the Event Bus (RFC-0006) — justified explicitly because "Scheduler needs it" (RFC-0005 §19, RFC-0006 §0/§15) — is consumed by **none** of the components it was built for: actual RFC-0007 never references it (it polls completion signals directly), and RFC-0006's closed event enum + producer allowlist (§3.2, §5.1) is violated by four later RFCs that publish `memory.*`, `tool.*`, `reflection.*`, `learning.*` events.

The skill package is a good v1-era artifact that has already drifted from its own architecture: 24 of 30 manifest paths point at directories that do not exist (a half-finished directory restructure), 12 skill directories carry names different from the skills inside them (including `reflection-engine/` containing `self-review` and `multi-agent-orchestrator/` containing `cavecrew`), one `exclusiveWith` pair is asymmetric, all versions (`2.0`) violate RFC-0002's strict-semver rule, and every skill lacks the `id`/`entryPoint`/`permissions`/`checksum` fields RFC-0002 declares required — **the entire pack fails its own Registry's validation as specified.**

There is **no implementation**: `kernel/`, `schemas/`, `examples/` contain only placeholder READMEs; no code, no schemas, no tests, no CI.

**Bottom line:** strong organs, unjoined skeleton. The architecture as written will not survive 10,000 skills, hundreds of models, or distributed execution — not because the subsystems are weak, but because the forks are precisely at the scale-bearing joints, and no mechanism (process or document) currently exists to close them.

---

## 2. Architecture Scorecard

Ratings 1–10, judged against the stated scale goals (10k+ skills, 100+ concurrent agents, distributed execution, plugin ecosystem, long-running agents, persistent memory, enterprise, local+cloud).

| Dimension | Score | Justification (evidence-based) |
|---|---|---|
| **Modularity** | 7 | Subsystem decomposition is genuinely good (15 distinct subsystems, each with non-goals). Docked for RFC-0011/0001 overlap and Scheduler/Executor contract fork. |
| **Separation of concerns** | 5 | Excellent *within* each RFC (e.g., RFC-0003's framework/policy split, RFC-0013's observe-don't-act). Poor *across* the corpus: four retry mechanisms (RFC-0003 §7.8, RFC-0007 §3.10, RFC-0008 §11.4, RFC-0012 §6.8), three backpressure designs, three checkpoint designs (RFC-0005 §9, RFC-0007 §12, RFC-0008 §7.3). |
| **Abstraction quality** | 6 | Individual interfaces are strong (`IPolicy`, Connector Interface, artifact envelope+payload split). But the same concept has 2–5 competing abstractions (plan, decision, dispatch, lease, state), and vocabulary drifts across generations (ExecutionPlan vs ExecutionGraph; PolicyDecision vs Decision; `ArtifactDeleted` vs `artifact.deleted`). |
| **Subsystem boundaries** | 5 | Declared boundaries are explicit and mostly right. Actual boundaries leak: RFC-0008 invented its own contracts for six subsystems rather than consuming theirs; RFC-0011 routes around RFC-0001; RFC-0010–0014 route around RFC-0006's governance model. |
| **Cohesion** | 8 | Each RFC is tightly scoped with responsibilities/non-goals/lifecycle/state machines. RFC-0010's seven memory tiers is the main over-reach (self-flagged, §20.1). |
| **Coupling** | 4 | Hidden coupling is the corpus's worst structural property: schema-coupling chains (RFC-0013 Lesson schema → RFC-0014 normalizer → RFC-0011 estimator), trust-based conventions (`readsContextFields`, RFC-0003 §18.1; `metadata` non-authoritativeness, RFC-0004 §4.8), and every subsystem hard-depending on Policy Engine availability with fail-closed semantics (system-wide correlated outage mode, never analyzed holistically). |
| **Corpus integrity / governance** | 2 | Four authoring generations; contradictory cross-references; occupied-number collisions; no status ledger, template, or process. (See §0.) |
| **Implementation readiness** | 1 | Zero code, zero schemas, zero tests; skill pack non-conformant with its own RFC-0002; `AGY_HANDOFF.md` confirms "no kernel implementation has been added yet." |
| **Overall** | **5/10** | Subsystem mean ≈ 6.5; corpus-level integrity and the joint forks drag the system score to 5. |

---

## 3. Major Strengths

1. **A real, disciplined determinism doctrine.** FACT: RFC-0001 §3 ("same inputs, same plan"), RFC-0003 §4.4 (pure `evaluate()`), RFC-0004 §2.3, RFC-0005 §15.7, RFC-0007 §16.5, RFC-0008 (determinism envelope, deterministic jitter §11.4), RFC-0015 §5.2 (deterministic sampling). Determinism is treated as a system invariant with test strategies (golden plans, golden decisions, replay tests) attached. This is rare and is the single most valuable property in the corpus.
2. **Fail-closed as a repeated, named invariant.** FACT: RFC-0001 §9 (predicates), RFC-0002 §14.5 (sandbox denies by default), RFC-0003 §13.4 (the governing statement), RFC-0004 §3.3, RFC-0010 §12.4, RFC-0012 §6.4. The corpus even enumerates its applications ("the fourth application… the fifth application"). Security posture at the specification level is coherent.
3. **Honest adversarial self-review.** FACT: every RFC has a Critical Self-Review or Critical Review section that flags genuine unresolved defects (RFC-0005 §18.1 declares its own schema broken for parallel execution; RFC-0008 §20 calls its own rollback "fundamentally leaky"; RFC-0002 §21.1 lists four weaknesses). This is exactly the culture a 10-year system needs.
4. **Registry design aimed at the right scale.** FACT: RFC-0002 §2.2 manifest/load two-phase split, inverted indices (§4.3), lazy loading, side-by-side versioning (§4.2, §10.4), quarantine (§7.7), partial-boot tolerance (§2.3), and explicit 10,000-skill benchmark targets (§15.4, §17.3). This subsystem was designed for the 10k-skill goal.
5. **Artifact System as the unifying data plane.** FACT: RFC-0004's envelope/payload split, ULID identity, derived lineage (not stored), lazy schema migration (§7.4), retention tiers with governance-critical never-delete defaults (§6.5). Later subsystems (Memory, Reflection, Learning, Observability) legitimately converge on it — the one place the corpus *did* compose.
6. **Governed self-modification.** FACT: RFC-0013 (observe, never act) + RFC-0014 (bounded, versioned, shadow-validated, auto-rollback parameter updates) is a genuinely sound closed-loop learning design with explicit threat analysis of self-poisoning.
7. **The skill-graph idea.** FACT: ORCHESTRATOR.md + frontmatter (`requires/consumes/produces/triggerPredicates/exclusiveWith/confidenceThreshold/escalateTo`) predates and motivates RFC-0001. Declarative, resolver-assembled pipelines instead of hand-wired flows is the right extensibility model for thousands of skills.

---

## 4. Major Weaknesses

1. **The three forks** (plan, dispatch, policy interface) — detailed in §1 and §5. Highest-severity architectural defect in the corpus.
2. **Event Bus governance is violated, not amended.** FACT: RFC-0006 §3.2 declares a *closed* event enum ("a producer publishing an event type not in this table is a schema violation") and §5.1 an explicit producer allowlist (Artifact System, RuntimeState only). RFC-0010/0012/0013/0014/0015 all publish namespaces anyway. Either RFC-0006 is amended or four accepted-adjacent RFCs are non-conformant; currently neither.
3. **Orphaned infrastructure.** INFERENCE: RFC-0006 was justified by Scheduler's needs (RFC-0005 §19; RFC-0006 §0, §15 names RFC-0007 as its first consumer); the actual RFC-0007 never references the Event Bus — its loop drains completion signals and heartbeats directly (§3.9, §11). RFC-0013 likewise subscribes to `scheduler.execution.completed`, an event actual RFC-0007 does not emit. The bus has producers-by-violation and consumers-of-phantom-events.
4. **Runtime State contract fork.** FACT: RFC-0005 specifies one mutable object per execution with whole-object CAS (`revision`), designated mutators, and a fixed schema (§3.2, §8.2). RFC-0008 assumes "hierarchical scoped keys; per-key CAS; watch; leases; checkpoint primitive" (Appendix A) and writes Execution Records, Attempt Records, command journals, and leases into it (§8.1–8.6) — a key-value store RFC-0005 never defines. RFC-0008 §19.6 flags this; nobody resolved it.
5. **Everything fails closed on the Policy Engine — simultaneously.** FACT: RFC-0003 §13.4, RFC-0008 §4.3 (fail-closed for authorization PEPs), RFC-0010 §12.4 (deny all memory ops), RFC-0011 §12.1, RFC-0012 §6.4. INFERENCE: a Policy Engine outage halts planning, memory, tools, and execution at once; no subsystem analyzes this correlated failure mode (RFC-0008 §20.4 comes closest for cache invalidation). Availability risk is systemic and unexamined.
6. **Escalation is an outcome with no owner.** FACT: RFC-0003 §18.2 item 3, RFC-0005 §18.2/§18.7, RFC-0006 §14.2 all independently flag that no component owns resolving an `ESCALATE` (human-in-the-loop path, timeout behavior, the reserved-but-unproducible `EscalationTimedOut` event). Long-running autonomous agents will park on `Blocked` indefinitely.
7. **Identity is assumed everywhere and specified nowhere.** FACT: policies key on principals/users (RFC-0003 §17.3), RFC-0008 injects scoped credentials (§13.1) requiring a "vault/identity system… a later RFC" (§21.2), RFC-0012 requires a Credential Store ("RFC-0013 Required" — a number now occupied by Reflection Engine), RFC-0010 has user/tenant tiers. There is no identity, tenancy, or secrets RFC and no principal model.
8. **The skill package has drifted from its own architecture** (§6 below) — the only "implementation" in the repo fails its own Registry spec.
9. **No configuration/bootstrap layer.** FACT: RFC-0004 §1.3 cites an "accepted finding that the Kernel should shrink to bootstrapping/lifecycle/DI/event-routing/shutdown only" — no such finding or kernel-bootstrap RFC exists in the repository. Subsystem startup ordering (Event Bus before the producers that must publish to it, etc.) is undefined.

---

## 5. Critical Bugs (verified, highest severity first)

Label: **[SPEC]** contradiction inside/between RFCs; **[DATA]** defect in repository artifacts (manifest/skills/docs).

1. **[SPEC] RFC-0007 §0 vs RFC-0004 — numbering collision.** RFC-0007 §4.1/§4.2 refer to "RFC-0004 (Execution Runtime, not yet designed)" while the actual RFC-0004 is the Artifact System. Any reader or implementer following RFC-0007's references integrates against the wrong subsystem.
2. **[SPEC] Conflicting cancellation semantics.** RFC-0007 §11.4: Scheduler transitions a task to `CANCELLED` *on issuing* cancel (fire-and-forget, explicitly to avoid ambiguity). RFC-0008 §11.6: cooperative cancel with grace period, `CANCEL_REQUESTED → CANCELLING → CANCELLED`, force-abort recorded. These cannot both govern the same edge.
3. **[SPEC] RFC-0005 §18.1 — `currentNode: string | null` cannot represent parallel node execution.** Self-declared: "This RFC should not be considered final until `currentNode` is corrected to `currentNodes: string[]`." A required-by-design correctness fix that was never applied. Related: §18.5 admits the parallel-execution pass through all sections was never completed.
4. **[SPEC] RFC-0008 vs RFC-0003 policy interface.** `Evaluate({action, principal, resource, …}) → {effect ∈ permit/deny/obligate, obligations[]}` (RFC-0008 §4.3, Appendix A) vs RFC-0003's `evaluateNode(node, context) → ALLOW|DENY|MODIFIED|ESCALATE|DEFER` with a closed `IPolicyContext` (§9.1, §14). There is no obligations concept, no policy-version snapshot identifier, and no principal-scoped request shape in RFC-0003.
5. **[SPEC] RFC-0011 vs RFC-0001 — duplicated planning authority.** Both produce the DAG the Scheduler runs (RFC-0001 §3 `ExecutionPlan`; RFC-0011 §9.4 `ExecutionGraph`), with different node models (`PlanNode.skillName` vs `ExecutionNode.skill_type` + `scheduling_hints`), different dependency semantics (RFC-0001 builds edges from `produces→consumes` + `requires`; RFC-0011 §11.2 adds RESOURCE/WORLD_STATE edges and resolves duplicate producers by "last writer" — contradicting RFC-0001's exclusivity-slot model), and different selection stages. RFC-0011's Methods require an RFC-0002 `methods` manifest block that does not exist (§19.2 admits this).
6. **[SPEC] RFC-0006 §3.2/§5.1 vs RFC-0010–0015 event publication.** Closed enum + producer allowlist (Artifact System, RuntimeState only) vs `memory.*`, `tool.*`, `reflection.*`, `learning.*`, `observability.*` publishers. Also topic-grammar drift: RFC-0006 `runtimestate.status.transitioned.{id}` (noun.verb) vs RFC-0010 `memory.written`, RFC-0012 `tool.invocation.started` (different segmentation).
7. **[SPEC] RFC-0007 depends-on header omits RFC-0004/0005/0006** while its own text depends on artifact existence ("Artifact Registry", §7.2/§10.3), runtime state reads (§10.1), and delivery of completion signals. The header is the machine-readable contract; it is wrong.
8. **[SPEC] RFC-0010's false substrate assumptions.** "If RFC-0008 defines model routing and RFC-0009 defines token budgeting (this is assumed, not confirmed)" — both wrong. RFC-0014 §6.3.6 repeats it ("consumed by RFC-0008 and/or RFC-0009… accepted and immutable"). Integrations were specified against subsystems that do not exist.
9. **[DATA] 24 of 30 `manifest.json` paths are invalid.** FACT (mechanically verified): paths like `foundation/token-budget/SKILL.md` do not exist; actual layout is `00-kernel/`, `01-planning/`, `03-analysis/`, `05-agents/`, `utilities/`. A RFC-0002 Discovery scan of this pack quarantines or mis-registers 80% of it.
10. **[DATA] Directory/skill identity mismatches (12 skills).** FACT: `checkpoint-engine/`→`checkpoint-manager`, `context-engine/`→`context-manager`, `model-orchestrator/`→`model-router`, `repository-cartographer/`→`repository-map`, `prompt-engineer/`→`prompt-coach`, `spec-generator/`→`project-spec`, `task-architect/`→`task-decomposer`, `reflection-engine/`→`self-review`, `gemini-bridge/`→`gemini-skill`, `multi-agent-orchestrator/`→`cavecrew`, `commit-generator/`→`caveman-commit`, `developer-stats/`→`caveman-stats`. Two of these (`reflection-engine`, `multi-agent-orchestrator`) collide with *kernel subsystem names* (RFC-0013 Reflection Engine) while containing unrelated skills — actively misleading to both humans and discovery tooling. Category directories skip `02` and `04`; on-disk taxonomy ≠ frontmatter `category:` ≠ manifest taxonomy ≠ RFC-0002 §19 layout.
11. **[DATA] Skill versions `2.0` violate strict semver** (RFC-0002 §3.2/§7.4 requires `MAJOR.MINOR.PATCH` — hard reject). All 30 skills. Also missing required fields: `id`, `entryPoint`, `permissions`, `capabilities` (and `checksum` at trust ≥ local-verified). FACT: entire pack fails RFC-0002 validation as written.
12. **[DATA] Asymmetric `exclusiveWith`:** `cavecrew → caveman` is declared; `caveman.exclusiveWith = ["ponytail"]` does not reciprocate. Violates RFC-0002 §3.3 symmetry rule; exercises the auto-symmetrize repair path (§7.5) on every boot — the pack is the corpus's own test fixture and it already trips the validator.
13. **[SPEC] `escalateTo` targets an `exclusiveWith` partner.** FACT: `caveman.escalateTo = ponytail` while mutually exclusive; same for `caveman-review → ponytail-review`. RFC-0001 never defines whether escalation *replaces* a node (and thus escapes the exclusion constraint) — `reresolve()`'s precomputed `fallbackChain` includes an excluded skill, and `satisfiesExclusion` checks "every skill already committed in the assignment" (§8.3). Underdetermined behavior on the most-traveled failure path of the flagship skill pair.
14. **[DATA] The quality loop is open.** FACT (mechanically verified): `ReviewVerdict` is produced by 3 skills and consumed by **zero**; 17 of 28 artifact types in the pack are produced but never consumed (`SecurityFindings`, `ArchitectureFindings`, `Checkpoint`, `PrunedContext`, `UpdatedDocs`, …). Nothing in the skill graph routes a review verdict back into execution gating — the ORCHESTRATOR.md narrative ("compare result confidence against threshold, escalate") is not expressible in the declared artifact vocabulary.
15. **[SPEC] `AGY_HANDOFF.md` contradicts the RFCs' own status model** — "The RFCs remain drafts/proposals" — while RFC-0003+ treat predecessors as "stable," and RFC-0010 §4 treats RFC-0008/0009 as "accepted and immutable per the master prompt." Three mutually incompatible claims of authority.

---

## 6. Scalability Risks (10k skills / 100+ agents / distributed / hot reload / plugins / continuous learning)

**What scales well (by design):**
- Registry at 10k skills: inverted indices, lazy load, parallel validation, warm-boot cache, rescan diff < 500ms target (RFC-0002 §15). 
- Resolver: per-slot candidate pools are small; sub-linear matching via `byProduces`/`byPredicateVariable` (RFC-0001 §7, §12).
- Executor: sharded single-writer executions, no global sequencer, idempotent dispatch, bounded everything (RFC-0008 §5.2, §15).
- Event bus: partition-by-execution ordering, replay, bounded retention (RFC-0006 §10).

**Bottlenecks and risks:**

1. **Single-process choke points that the corpus itself flags:** Registry readers-writer lock at instance granularity (RFC-0002 §4.5, flagged §21.1.2), Scheduler single write path (RFC-0007 §7.7, flagged §18.1.2 as *more* likely to bottleneck than RFC-0002's), in-memory hot RuntimeState (RFC-0005 §14.1), single-instance Artifact Store with explicitly undesigned multi-instance consistency (RFC-0004 §16.2). INFERENCE: 100+ concurrent agents on one kernel hits the Scheduler write path first — by RFC-0007's own analysis it scales with *event rate*, not plan size.
2. **Distributed execution is intent, not design.** FACT: RFC-0007 §18.1 item 3 — "the claim 'supports distributed execution without redesign' is currently a design *intent*… not a demonstrated property"; §14 externalizes leader election; RFC-0002 §20 defers distributed registries; RFC-0004/0005 defer theirs; RFC-0008's isolation is "logical only" (D-11) — noisy-neighbor CPU/memory exhaustion is conceded. INFERENCE: the "local and cloud execution / distributed" goal has extension points but zero validated design; no consensus, ownership-failover, or data-placement story exists anywhere in the corpus.
3. **Reflection throughput ceiling.** FACT: RFC-0013 §15.2 — ~86 reflections/minute at 10 concurrent sessions ≈ 5,160/hour; §15.4 concedes 1.2GB/day of Reflection Artifacts at 1,000 executions/hour and O(E×T) ArchitecturalCritic cost on large graphs. INFERENCE: at sustained 100-agent scale, reflection lag becomes hours and the learning loop (already 6–48h cycles in RFC-0014) decouples from operational reality.
4. **Policy Engine as a global serial dependency.** Every dispatch, retry, memory op, tool call, plan step, and artifact commit consults policy (RFC-0003 §11 targets <20ms/plan; RFC-0010 §14.3 admits 10–50ms uncached per memory op). Cached paths exist, but RFC-0008 §20.4's thundering-herd on version flip is unresolved, and no RFC specifies Policy Engine horizontal scaling.
5. **Hot reload / dynamic plugins:** well designed at the Registry layer (drain-old-serve-new, refcount floor — RFC-0002 §5.5/§11.2) but the consumers aren't: RFC-0008 pins skill + policy version per execution (correct for audit, but means hot reload never reaches in-flight work), and no RFC addresses plugin *code* supply chain (explicitly out of scope, RFC-0002 §14.2, no other owner).
6. **Continuous learning feedback latency:** plan-time estimates are corrected on 6–12h cycles with 24h–30d evidence windows and 48h post-update monitoring (RFC-0014 §5.3). INFERENCE: in a fast-moving deployment, learned parameters will chronically trail reality; RFC-0014's own §20.2 concedes the constants are arbitrary pending a year of production data.
7. **Tenancy is asserted, never designed.** `tenant_id` appears in RFC-0010/0013/0014/0015 data models; per-tenant Parameter/Evidence stores are the only isolation mechanism offered (RFC-0014 §15.1). No tenancy boundary, quota, or noisy-tenant RFC exists.

---

## 7. Security Risks

**Strong (FACT):** trust levels per scan root with signature allowlist (RFC-0002 §14.1/§14.3); path-traversal validation incl. symlinks (§14.4, §17.1); sandbox-contract fail-closed (§14.5); predicate-as-data anti-injection (RFC-0001 §13); policies sandboxed, framework-emits-events, engine-without-privilege (RFC-0003 §12); checksum-on-every-read, tombstones, plugin-artifact signatures (RFC-0004 §11); scoped revocable credentials, fence tokens as secrets, redaction-at-egress (RFC-0008 §13); SSRF/exfil-aware sandbox hooks with per-chunk inspection (RFC-0012 §13); permission-checked replay, quota, idempotency (RFC-0012); lesson-poisoning statistical defenses (RFC-0013 §13).

**Gaps (ranked):**

1. **The sandbox has no owner.** RFC-0002 §14.5 fixes the *contract* and defers the mechanism; RFC-0012 §6.9 provides hooks and a null sandbox; RFC-0008 defers physical isolation to a Resource RFC that doesn't exist. INFERENCE: the entire permission model bottoms out in an unimplemented, unspecified enforcement layer — this is the single largest security exposure for a plugin ecosystem.
2. **No identity, authentication, or secrets subsystem** (RFC-0008 §21.2; RFC-0012 §20.7; policy principals in RFC-0003 §17 with no principal source). Commands are "authenticated (caller identity)" (RFC-0008 §13.6) by an unspecified mechanism.
3. **Audit-log tamper resistance deferred** (RFC-0003 §18.2 item 2); RFC-0004 §11.4 encrypts at rest but key management is unspecified; trusted-key distribution/rotation unspecified (RFC-0002 §14.3 allowlist only).
4. **Policy cache staleness windows** (60s memory — RFC-0010 §14.3/§18.5; 120s tools — RFC-0012 §6.4; 5s decisions — RFC-0003 §3.8) are each individually justified but never analyzed as a system: a revocation may take up to the longest TTL to bind across surfaces.
5. **Memory poisoning is mitigated statistically only** (confidence accumulation — RFC-0013 §13.2); a patient attacker across many executions is detected "through other monitoring channels" that are not specified (anomaly detection deferred — RFC-0010 future work).
6. **Capability-name hierarchy is unenforced** (RFC-0012 §20.4): `code.execute` policy does not govern `code.execute.python` without prefix matching that RFC-0003 lacks — an operator foot-gun that becomes a real escalation path at 10k capabilities.
7. **Observability as an exfiltration channel** is honestly flagged (RFC-0015 §20.6) but its mitigation (query gating + audit) depends on the same unspecified identity layer.
8. **Supply chain** for skill code's own dependencies (npm/pip) is explicitly out of scope (RFC-0002 §14.2) and unowned anywhere else — unacceptable for an enterprise plugin marketplace goal.

---

## 8. Technical Debt (rewrite risks, fragile abstractions, gold plating)

1. **Spec-drift debt (highest):** every uncorrected cross-generation assumption (§0, §5) is a future rewrite. The RFC-0008 assumed-contract appendix alone (Appendix A) contains ≥6 divergences from published text; each one implemented as-written becomes a rewrite.
2. **Four retry engines, three checkpoint systems, two lease models, two plan schemas, five policy dialects** — consolidation debt that compounds: every new subsystem must pick a generation to follow, deepening the fork.
3. **Skill-pack migration debt:** mechanical but blocking — ids, semver, entryPoints, permissions, checksums, path repair, symmetry fixes, dead-artifact routing (§5 items 9–14). The pack is simultaneously the corpus's only executable asset and its least conformant artifact.
4. **Gold plating (self-admitted):** RFC-0010's seven memory tiers ("early deployments may find three or four sufficient" — §20.1); RFC-0008's full journal/lease/PEP machinery for sub-millisecond skills ("This RFC is heavy" — §20.9); RFC-0013's counterfactual analysis (§20.3 "speculative and may be misleading"); RFC-0015's eleven view models with zero implementation. RECOMMENDATION: mark explicit "Phase 1 subset" sections rather than relying on readers to find the self-review caveats.
5. **Fragile conventions:** `metadata` must-never-be-authoritative (RFC-0004 §4.8, RFC-0005 §3.2), `readsContextFields` honesty (RFC-0003 §18.1), "frames→bus, facts→state" (RFC-0008 D-2) — all enforced by review discipline only; each is a slow leak once multiple implementers exist.
6. **Premature determinism machinery** (hash-derived jitter, deterministic sampling, execution-ID derivation) is elegant but unvalidated by any running system — treat as hypotheses with tests, not guarantees.
7. **Documentation debt:** glossary has 8 entries while the corpus introduces hundreds of terms; `docs/architecture/` and `docs/diagrams/` are empty despite being RFC-0000's linked entries; RFC-0001 cites "Design Principle #4" and RFC-0007 cites "#2/#3" of a Design Principles document that does not exist in the repository.

---

## 9. Missing Architecture (subsystems with no owning RFC, ranked by dependency order)

1. **Resource Manager & Execution Ledger** — required by: RFC-0003 CostPolicy (ledger snapshots), RFC-0007 §3.8/§8 (reservations, worker registration), RFC-0008 (entire §3 non-goal + §21.1), RFC-0004 §16.1 (storage backend), RFC-0010 (cache tiers), RFC-0015 (resource dashboards). Referenced by ≥6 RFCs; exists nowhere. The ledger's *data shape* was bootstrapped (RFC-0004 §5.19) but accounting, budgets, quotas, and placement are undesigned.
2. **Identity, Principals & Tenancy** — every policy decision, memory scope, user tier, and command authorization depends on it (RFC-0003 §17, RFC-0005 §3.8, RFC-0010 §6.8, RFC-0012 §13, RFC-0014 §15.1). Nothing exists.
3. **Secrets / Credential Store** — RFC-0008 §13.1's revocation-on-cancel and RFC-0012's `CredentialReference` are hard dependencies; the "Required" RFC number suggested for it (0013) was consumed by Reflection Engine.
4. **Sandbox enforcement contract** — the trust model's physical enforcement (RFC-0002 §14.5, RFC-0012 §6.9). Needs an owner, an attestation model (RFC-0012 §20.2), and a default implementation posture per deployment class.
5. **Session / Conversation Manager** — RFC-0005 §18.3/§18.9: `session`-scoped variables have lifetime semantics with no owning mechanism; RFC-0010's episodic/user tiers inherit the gap.
6. **Model Registry & Router** — goal states "hundreds of models"; today model routing is a *skill* (manifest `model-router`), an assumed RFC-0008/0009 subsystem (RFC-0010, RFC-0014 §6.3.6), and a reference in RFC-0007 §8.1. No contract for model identity, capability, cost, failover, or keys exists.
7. **Escalation / Human-in-the-loop Workflow owner** — triple-flagged (RFC-0003 §18.2, RFC-0005 §18.7, RFC-0006 §14.2). Required for `ESCALATE` to be implementable at all.
8. **Kernel Bootstrap, DI & Lifecycle** — subsystem startup ordering, wiring, config layering beyond policy (RFC-0003 §17), shutdown draining. RFC-0004 §1.3 cites this as accepted direction; no document exists.
9. **Event namespace & schema governance** (small but load-bearing): a registry for topics/event types/attribute namespaces demanded by RFC-0010 §19.3, RFC-0012 §19.4, and violated in practice by RFC-0006's closure.
10. **Plugin packaging, distribution & marketplace trust** — RFC-0002 §20 defers; the 10k-skill/plugin-ecosystem goal requires it (signing keys at scale, updates, dependency bundles).
11. **Goal ingestion / UserIntent & SystemTrigger** — RFC-0004 §17.3 (non-human-triggered plans have no lineage root); RFC-0011 pushes NL parsing to an undefined "Goal Parsing skill."
12. **Data sovereignty / right-to-delete** — RFC-0010 §20.5 declares its own user-delete specification inadequate for distributed stores; compliance-grade requirement for enterprise deployments.

**Also missing as artifacts:** `schemas/` content (JSON Schema for manifests, artifacts, events, policy context), the Design Principles document, the RFC process/status ledger, the diagrams RFC-0000 indexes.

---

## 10. Production Readiness

| Measure | Estimate | Basis |
|---|---|---|
| **Architecture completeness** | **~55–60%** of the kernel vision | 11 of ~16 needed subsystems have RFCs; but Resource Manager, Identity/Secrets, Sandbox, Session, Model routing, Bootstrap — all dependency roots for the designed subsystems — are absent; and the plan/dispatch/policy forks mean the designed 60% is not one architecture but three overlapping ones. |
| **Implementation readiness** | **~2%** | No code, no schemas, no tests, no CI. The only concrete artifact (skill pack) fails its own Registry validation. Positives: unambiguous interface-first RFCs and a stated build order in AGY_HANDOFF.md make implementation *startable* after reconciliation. |
| **Risk level** | **High (severe)** | Forks at load-bearing joints; security bottoms out in an unowned sandbox; no identity; distributed story unvalidated; governance process absent. |
| **Biggest blockers** | 1) Corpus reconciliation (§0); 2) Resolver-vs-Planner decision; 3) Scheduler-vs-Executor dispatch/cancel contract; 4) Policy interface + amendment set (attributes, contexts, version pinning); 5) Resource Manager & Ledger RFC; 6) skill-pack migration to RFC-0002. |
| **Largest unknowns** | 1) Can RFC-0005's state model carry RFC-0008's per-key/lease usage (or vice versa)? 2) Real latency of the policy-on-everything design at 100 agents. 3) Whether HTN Method libraries can be authored at 10k-skill scale (RFC-0011 §20.1's own open question). 4) Event-bus volume/retention economics (RFC-0006 §14.3 placeholder). 5) Sandbox enforcement feasibility across local/cloud deployments. |

---

## 11. Recommended Build Order

**Phase 0 — Govern (no code):**
1. RFC-0000A Corpus Reconciliation & Status Ledger (accept/amend/reject every RFC; retire or assign RFC-0009; numbering authority; single glossary pass; publish the Design Principles doc RFC-0001/0007 cite).
2. Amendment set A (see §12, items 1–6): close the policy/event/manifest forks *on paper* before any interface is coded.

**Phase 1 — Contracts as code (de-risk cheapest first):**
3. Populate `schemas/` with JSON Schema for: skill manifest (post-amendment), artifact envelope + the §5 taxonomy types, event envelope + normalized topic grammar, policy context/decision, runtime state snapshot. Golden fixtures from RFC-0002 §17.7, RFC-0001 §11.2, RFC-0003 §15.5.

**Phase 2 — Skill pack conformance:**
4. Fix manifest paths/dirs (or adopt the numbered taxonomy and regenerate manifest), apply `id`/semver/entryPoint/permissions/checksum, symmetrize `exclusiveWith`, define escalation-vs-exclusion semantics, and wire the dead artifacts (`ReviewVerdict` et al.) into the graph or delete them.

**Phase 3 — Kernel in dependency order** (matches AGY_HANDOFF.md, which is correct despite the RFC numbering not matching it — RFC-0001 depends on RFC-0002, so build Registry first):
5. Registry & Loader → Resolver → Policy Engine (+ attribute/context amendment landed) → Artifact System → Runtime State (with the `currentNodes[]` fix) → Event Bus → Scheduler ( consuming the bus or explicitly not, per amendment) → Executor (on the reconciled dispatch contract).
   Each step ships its RFC's specified test suite (state-machine conformance, determinism/golden tests, fuzzing) as the acceptance gate.

**Phase 4 — Platform subsystems:** Tool Runtime → Memory (Phase-1 subset: Working/Episodic/Semantic only) → Reflection → Learning → Observability.

**Phase 5 — The missing roots (can start in parallel with Phase 3 where interfaces are stable):** Resource Manager & Ledger (before Scheduler perf-validation), Identity/Secrets (before any multi-user deployment), Sandbox (before any third-party skill), Session, Model Registry, Escalation owner, Plugin distribution.

---

## 12. Suggested Amendments (none rewrite accepted text; all are additive or reconciling)

1. **Amendment to RFC-0006** — replace closed event enum + producer allowlist with a versioned, registry-governed open namespace model (`memory.*`, `tool.*`, `planner.*`, `reflection.*`, `learning.*`, `observability.*`, `scheduler.*`, `executor.*`), one topic grammar, and payload schema ownership rules. Formalizes what RFC-0010 §19.3 and RFC-0012 §19.4 already requested.
2. **Amendment to RFC-0003** — (a) extensible policy attribute namespaces and evaluation contexts (`PLAN_TIME` [RFC-0011 §19.3], `TOOL_INVOCATION` [RFC-0012 §19.2], memory/reflection/learning attribute sets [RFC-0010/0013/0014]); (b) policy snapshot/version identifiers with pinning (RFC-0008 §19.1 — required for its determinism envelope); (c) prefix-matching semantics for hierarchical capability names (RFC-0012 §20.4); (d) obligations as a first-class outcome or their rejection (RFC-0008 assumes them).
3. **Joint amendment RFC-0007 + RFC-0011** — one Execution Graph contract (or explicit layering: Planner emits goal decompositions; Resolver performs artifact-driven skill selection within them), plus reconciled duplicate-producer semantics (exclusivity vs last-writer).
4. **Amendment to RFC-0007** — correct cross-references (RFC-0004 = Artifact System; RFC-0008 = Executor), complete the `Depends on` header, adopt the Event Bus or document direct-signal equivalence, and align §11 with RFC-0008 §7 (one dispatch + one cancellation contract; one lease model).
5. **Amendment to RFC-0008** — replace Appendix A assumed contracts with the published RFC-0001–0007 interfaces (policy, artifact `create/supersede`, runtime-state model) per its own §19 compatibility-note mechanism.
6. **Amendment to RFC-0002** — add manifest blocks: `methods` (RFC-0011 §19.2), `tool_dependencies` (RFC-0012 §19.1), `compensations` + retryability declaration (RFC-0008 §19.5), `memory_profile` (RFC-0010 §4).
7. **Amendment to RFC-0005** — apply its own §18.1/§18.5 fixes (`currentNodes[]`, full parallel pass), and decide the state-model question: single-object CAS (as written) vs scoped key-value + watch + leases (as RFC-0008 needs). One of the two RFCs must move.
8. **Amendment to RFC-0004** — formal event payload schemas (RFC-0006 §14.1), event-name normalization (`ArtifactDeleted` ↔ `artifact.deleted`), namespace cardinality answer for per-execution scopes (RFC-0008 §19.2), mandatory `maxDepth` on lineage traversal (its own §17.7).
9. **Future RFCs (new numbers, in §9's order):** Resource Manager & Ledger; Identity/Tenancy; Credential Store; Sandbox Contract; Session Manager; Model Registry & Router; Escalation Workflow; Kernel Bootstrap & Configuration; Plugin Packaging/Marketplace; Data Sovereignty.
10. **Implementation Note (immediate, no RFC needed):** repair `manifest.json` paths, directory names, README count (25→30), and category gaps; until then treat the manifest as authoritative for *metadata* and the filesystem as authoritative for *location*, and regenerate one from the other.

---

## 13. Final Verdict

**As a body of subsystem design: B+.** RFC-0001–0006 would, on their own, be a strong foundation for the stated scale goals; RFC-0008 is one of the more honest executor specifications I have reviewed; RFC-0013/0014's governed-learning loop is genuinely ahead of common practice.

**As one operating system: D+.** The corpus is not currently an architecture; it is three architectures interleaved by number, plus a skill pack that no longer conforms to its own registry. Every one of the scale goals — 10,000 skills, hundreds of models, 100+ concurrent agents, distribution, plugin ecosystem, enterprise — stresses exactly the joints where the corpus forks: plan construction, dispatch/control, policy interface, state model, event governance. Left as-is, the first implementation team will silently choose a fork per subsystem, and the divergence will harden into code within months.

**Implementation readiness: ~2%. Architecture completeness: ~55–60% with critical roots (Resource Manager, Identity, Sandbox, Model routing, Session) absent. Risk: High.**

The good news is that the fix is cheap *right now* — it is all paper. The corpus's own culture (fail-closed self-review, amendment-not-rewrite discipline, compatibility-notes mechanisms) is exactly the toolset needed to reconcile it. Execute Phase 0 (§11) before writing a line of kernel code, and this becomes a buildable system with an unusually strong specification base. Skip Phase 0, and the ten-year maintenance burden starts at a fork.

---

### Appendix A — Verified Data Discrepancies (mechanical checks)

| Check | Result |
|---|---|
| Files / lines | 86 files, ~22.9k lines, 1.5MB (excl. .git) |
| RFCs present | 0001–0008, 0010–0015 (0009 absent; noted in AGY_HANDOFF.md) |
| RFC statuses | 0001–0007 Draft; 0008 "Draft for review"; 0010–0015 Proposed; none Accepted |
| Skills on disk | 30 (`SKILL.md` count) |
| Manifest entries | 30; `name:` fields match disk 1:1 |
| Manifest invalid paths | 24/30 (`foundation|execution|planning|quality/...` do not exist) |
| README skill count | 25 (stale) |
| Dir-name ≠ skill-name | 12 skills |
| `exclusiveWith` asymmetry | `cavecrew → caveman` unreciprocated |
| `escalateTo` → excluded partner | `caveman→ponytail`, `caveman-review→ponytail-review` |
| Artifact types consumed, never produced | 11 (external inputs: `RawRequest`, `Subtask`, `ConversationState`, …) |
| Artifact types produced, never consumed | 17 (incl. `ReviewVerdict`, `SecurityFindings`, `Checkpoint`, `PrunedContext`) |
| Skill versions | all `2.0` (not strict semver) |
| `kernel/`, `schemas/`, `examples/`, `docs/architecture/`, `docs/diagrams/` | placeholder READMEs / empty |

### Appendix B — Subsystem Dependency Graph (declared, condensed)

```
0002 Registry ──► 0001 Resolver ──► 0003 Policy ──► 0004 Artifacts ──► 0005 RuntimeState ──► 0006 Event Bus
                       ▲                                                            (intended consumer: 0007)
                       │                                                            actual consumers: 0010–0015
0007 Scheduler (declares deps: 0001–0003 ONLY; text depends on artifacts/state/signals)
0008 Executor  (extends 0001–0007 by number; assumes its own contracts for all of them)
0010 Memory    (0004,0005,0006,0007; assumes false 0008=model-routing, 0009=token-budget)
0011 Planner   (0001,0003–0007,0010; competes with 0001 for plan authority)
0012 Tools     (0001–0007,0010,0011)
0013 Reflection(0003–0007,0010–0012)
0014 Learning  (0003,0004,0006,0007,0010–0013; assumes 0008/0009 model routing)
0015 Observability (0003–0007,0010–0014)

Phantom dependencies (referenced, no owning RFC):
  Execution Ledger / Resource Manager · Identity/Principals · Secrets Vault ·
  Sandbox mechanism · Session · Model Router · Escalation owner · Kernel bootstrap/DI ·
  Goal Parsing / SystemTrigger
```

**Cycles:** no true control-flow cycles found in declared edges; the dangerous structures are (a) contract *forks* (0005↔0008 state model; 0007↔0008 leases/cancellation; 0001↔0011 plan authority) and (b) a data-schema cycle chain 0013 Lesson → 0010 Reflection Memory → 0014 Evidence → 0011 Estimator → (calibration observations) → 0013, with the schema owned by whichever RFC was written last.

*End of review.*
