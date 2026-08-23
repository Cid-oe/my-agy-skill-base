# Audit Regression Matrix

This document turns the 2026-08-21 audit findings into a CI-enforced regression map.

Phase 1 gate:

- Every `Critical` finding must map to at least one regression test.
- Every `High` finding must be either fixed or explicitly accepted as technical debt.
- `.github/workflows/ci.yml` runs build, typecheck, and the full test suite on PRs plus pushes to `main` and `arena/**` branches.

## Critical findings

| Finding | Severity | Status | Regression test | Notes |
|---|---|---|---|---|
| CRIT-01 | Critical | Fixed | `packages/executor/src/executor.test.ts` - `Executor runs a module-backed skill in an isolated worker and returns real output (SRC-1, SRC-2, SRC-3)`; `tests/src/echo-skill.test.ts` - `Executable skill runs end-to-end through the worker sandbox` | Module-backed skills execute through the worker harness instead of the kernel main thread. |
| CRIT-02 | Critical | Fixed | `packages/event-bus/src/event-bus.test.ts` - `EventBus preserves strict sequential FIFO delivery across concurrent publishers` | Concurrent same-key publishes are chained through one per-key tail promise. |
| CRIT-03 | Critical | Fixed | `packages/runtime-state/src/runtime-state.test.ts` - `RuntimeState rolls back on command failure and recovers transaction queue` | Failed command batches resolve with failure, roll back, and do not poison the shared transaction queue. |
| CRIT-04 | Critical | Fixed | `packages/scheduler/src/scheduler.test.ts` - `Scheduler transitions plan to error state and cancels other nodes on task failure` | A failed node transitions the plan to failed, cancels in-flight work, and releases runtime tracking. |
| CRIT-05 | Critical | Fixed | `packages/resolver/src/resolver.test.ts` - `SkillResolver resolves transitive dependency pipelines (S3 -> S2 -> S1)`; `apps/cli/src/cli.test.ts` - `CLI run drives a multi-stage dependency plan to completion (EX-2)` | Resolver pulls prerequisite producers recursively and the CLI advances all dependency waves. |
| CRIT-06 | Critical | Fixed | `packages/policy/src/policy-engine.test.ts` - `PolicyEngine enforces fail-closed default when 0 policies registered`; `packages/executor/src/executor.test.ts` - `Executor enforces policy lease coverage of required capabilities (SRC-5, SRC-6)` | Policy now defaults deny, leases are persisted, and executor validates required capabilities before executing. |
| CRIT-07 | Critical | Fixed | `packages/executor/src/executor.test.ts` - `Executor hard-terminates a hanging worker on timeout (SRC-1)`; `packages/executor/src/executor.test.ts` - `Executor enforces timeouts and frees worker slot immediately` | Worker-backed execution is terminated on timeout and worker slots are released deterministically. |
| CRIT-08 | Critical | Fixed | `packages/runtime-state/src/runtime-state.test.ts` - `RuntimeState persists WAL and replays state on reboot after crash`; `packages/artifact/src/artifact-store.test.ts` - `ArtifactStore persists blobs to a durable on-disk CAS and recovers on reboot (SRC-14)`; `apps/cli/src/cli.test.ts` - `CLI runtime persists state and artifacts across restarts when persistenceDir is set` | Runtime state has durable WAL replay and artifacts are stored in an on-disk CAS. |

## High findings

| Finding | Severity | Status | Regression test or debt record | Notes |
|---|---|---|---|---|
| HIGH-01 | High | Fixed | `packages/runtime-state/src/runtime-state.test.ts` - `RuntimeState ensures atomic rollback of multi-command batches` | Transactions apply synchronously through the single-writer queue and snapshots deep-clone state. |
| HIGH-02 | High | Fixed | `packages/scheduler/src/scheduler.test.ts` - `Scheduler dispatches by manifest priority under bounded concurrency (SRC-8, SRC-9)` | Priority comes from plan-node manifest priority and per-node first-ready timestamps support meaningful aging. |
| HIGH-03 | High | Fixed with bounded operational debt | `packages/registry/src/registry.test.ts` - `SkillLoader acquires, releases, and drains instances properly during reload`; `packages/registry/src/registry.test.ts` - `SkillLoader enforces the drain timeout for unloading in-flight skills (SRC-18)` | The arbitrary 100ms drain is replaced by configurable `drainTimeoutMs`. Forced disposal after the configured deadline is accepted debt and an intentional safety valve to avoid unbounded draining. |
| HIGH-04 | High | Fixed | `packages/event-bus/src/event-bus.test.ts` - `EventBus cleans up per-key queues on drain and avoids memory leaks`; `packages/runtime-state/src/runtime-state.test.ts` - `RuntimeState checkpoints and compacts the WAL to bound growth (EX-5)`; `tests/src/stress.test.ts` - `Stress: many concurrent 2-node plans complete with no worker-slot leaks` | EventBus queue tails are deleted on drain, WAL growth is compacted, and scheduler/executor resources are stress-tested for leaks. |
| HIGH-05 | High | Fixed | `packages/resolver/src/resolver.test.ts` - `SkillResolver reresolve validates the fallback against the registry (SRC-12)`; `packages/resolver/src/resolver.test.ts` - `SkillResolver reresolve produces a new immutable plan instance` | Fallback re-resolution validates candidate skill existence and returns a new plan instead of mutating the original. |
| HIGH-06 | High | Fixed | `packages/registry/src/registry.test.ts` - `SkillRegistry enforces manifest schema validation on register (SRC-16)`; `packages/registry/src/registry.test.ts` - `SkillRegistry scan quarantines malformed manifests and recurses nested dirs (SRC-17)`; `apps/cli/src/cli.test.ts` - `CLI skill install and run executes full end-to-end workflow` | Registry validates manifests and quarantines malformed inputs; CLI reports invalid JSON instead of throwing. Cryptographic signature validation remains out of v0.1 scope until signed skill distribution exists. |
| HIGH-07 | High | Fixed | `packages/policy/src/policy-engine.test.ts` - `PolicyEngine validates subpath scope containment constraints`; `packages/policy/src/policy-engine.test.ts` - `PolicyEngine rejects prefix-collision and path-traversal scope bypasses (EX-3, EX-4)`; `packages/policy/src/policy-engine.test.ts` - `PolicyEngine rejects expired leases and sweeps them from state` | Scope checks normalize paths and require real subpath containment; expired leases are rejected and swept. |
