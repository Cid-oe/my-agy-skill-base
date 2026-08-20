# Phase-0 Deliverable 10 — Phase 1 Build Plan

**Objective:** convert the reconciled corpus into running, tested kernel
code for the execution path, in dependency order, with the RFCs' own test
sections as acceptance gates. Nothing here redesigns architecture; where
implementation reveals a contract defect, it is fixed by **new amendment or
ADR**, never by silent code divergence.

## Stage 0 — Ratify & freeze contracts (paper only)

| Step | Work | Gate |
|---|---|---|
| 0.1 | Ratify the 14-amendment bundle (jointly: 0001-A1+0011-A1; 0007-A1+0008-A1) | **G0**: amendments → Ratified; RFCs 0007/0008/0010–0015 → Review |
| 0.2 | Author `schemas/`: `manifest/` (RFC-0002+A1), `artifacts/` (envelope + §5 taxonomy + events per 0004-A1 R2), `events/` (envelope + topic registry), `policy/` (Decision, DecisionRequest, attributes), `state/` (ExecutionState, state-domain records) | **G1**: golden fixtures validate; RFCs 0001–0006 eligible → Accepted |
| 0.3 | Stand up `tests/` harness skeleton + CI (lint frontmatter, manifest↔disk reconciliation — the Phase-0 scripts productized) | continuous from here |

## Stage 1 — L0/L1: Registry, Resolver (conformance fixture = skill pack)

- **1a Registry & Loader (RFC-0002):** discovery (scan roots, maxDepth),
  validation pipeline, quarantine, indices, side-by-side versions, lazy
  load, hot reload. Acceptance: RFC-0002 §17 suites (unit, integration,
  stress @10k synthetic skills, fuzz, mutation, golden registry) + skill
  pack loads clean at `local` trust (30/30, zero quarantine). **Gate G2.**
- **1b Resolver (RFC-0001+A1):** matcher/ranker/solver/plan-builder,
  slots, fallback chains, golden plans, adversarial predicate fuzzing,
  backtracking bound test, reresolve isolation (§11). ADRs for weight
  configuration surface.

## Stage 2 — L1: Policy Engine (RFC-0003+A1)

Framework + 8 built-ins, conflict-resolution procedure, two-tier caching,
incremental continuous evaluation, audit log. Acceptance: §15 suites —
especially property tests on the Aggregator and determinism-under-parallel
tests (15.5/15.6). Performance milestone #1: measure the
policy-on-everything latency budget (readiness risk #3).

## Stage 3 — L2/L3: Artifact System, Runtime State

- **3a Artifacts (RFC-0004+A1):** envelope/checksum/ULID, schema registry
  + lazy migration, tiered store, lineage queries (mandatory maxDepth),
  retention/tombstones. Acceptance: §14 property tests (immutability, DAG,
  checksum determinism, round-trip).
- **3b Runtime State (RFC-0005+A1):** state domains, root record with
  `currentNodes[]` (**the §18.5 re-verification pass happens here**),
  per-record CAS + domainRevision, watch, lease primitives, checkpoints,
  crash-recovery walk-back. Acceptance: §16 suites incl.
  crash-at-every-point.

## Stage 4 — L4: Event Bus (RFC-0006+A1)

Topic-routed durable log, registry-governed ingestion, aliases, consumer
groups, replay window, backpressure/gap states. Acceptance: delivery
semantics tests (at-least-once, per-key ordering, idempotent redelivery).

## Stage 5 — L5: Scheduler + Executor (jointly, per the amended contract)

- **5a Executor (RFC-0008+A1):** admission/prepare/run/finalize, attempts,
  streams+offsets, PEPs against the real Policy Engine, lease+fence on the
  real RuntimeState, backpressure (Hold). Acceptance: §17 determinism
  replay, crash injection, cancellation/rollback matrix.
- **5b Scheduler (RFC-0007+A1):** six queues, incremental readiness,
  fairness aging, critical-path ties, reservations, `CANCELLING`
  cancellation, `scheduler.*` event publication; consumes Orders'
  completions. Acceptance: §16 suites incl. chaos + dispatch determinism
  (16.5). **Gate G8: end-to-end demo** — goal → Resolver → Policy →
  Scheduler → Executor → artifacts/state/events, resumed after kill -9.

## Parallel tracks (start whenever staffing allows)

- **T1 Skill graph semantics:** consumers for the 17 dead artifact types
  (starting with `ReviewVerdict` gating); ADR-governed.
- **T2 Root RFCs chartering:** RFC-0016 (Resource Manager & Ledger) and
  RFC-0017 (Identity & Credentials) drafts — required before Phase 2;
  RFC-0020 (Sandbox) before any third-party skill.
- **T3 Examples:** `examples/` grows one runnable scenario per completed
  stage.

## Rules of engagement

1. Implementation divergence from an RFC = stop-and-amend (ADR + amendment),
   never drift.
2. Every stage lands its RFC's test suites in `tests/`; gates are binary.
3. Performance milestones are measurement first, optimization only with
   data (no premature tuning of the deterministic machinery).
4. Status ledger updates are part of each gate (RFC → Accepted at G1;
   → Implemented at its stage gate).
