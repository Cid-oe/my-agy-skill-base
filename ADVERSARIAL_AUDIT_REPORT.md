# AGY Adversarial Test and Flaw Report

**Date:** 2026-08-23  
**Branch:** `arena/01a02fd0-my-agy-skill-base`  
**Scope:** Current TypeScript implementation, compiled runtime behavior, persistence paths, lifecycle handling, and existing regression suite.

## Executive summary

The normal build and regression suite are green, but adversarial runtime probes reproduced multiple correctness, lifecycle, authorization, persistence, and security failures. The current `10.0 / 10` production-readiness claim is not supported by the implementation evidence.

The highest-risk issue is that worker-thread execution is described as a sandbox but is not an OS/process security boundary. A loaded module can access the host filesystem and environment. In addition, policy leases can be minted without policy evaluation, and an executor skips lease validation entirely for skills with no declared permissions.

This report separates **confirmed runtime failures** from **code-review risks**. It does not claim that a finite audit can prove the absence of every possible defect.

## Validation performed

| Check | Result |
|---|---|
| `npm ci` | Passed; 17 packages installed |
| `npm run build` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | Passed: 20/20 compiled test suites |
| `npm audit --audit-level=low` | Passed: 0 vulnerabilities |
| Adversarial runtime probes | 20+ distinct failures reproduced |

The adversarial probes exercised the compiled packages with malformed plans/manifests, failed event buses, corrupt storage, expired/revoked leases, invalid lifecycle state, cycles, concurrent operations, and malicious module code.

---

## P0 — security and correctness blockers

### P0-01 — Worker threads are not a security sandbox

**Confirmed.** A module-backed skill executed in `node:worker_threads` was able to write to the host filesystem and read `process.env`.

**Evidence:** `packages/executor/worker-harness.mjs`, `packages/executor/src/executor.ts:273-348`

The worker has no process/container boundary, Node permission policy, filesystem restriction, network restriction, or credential isolation. `resourceLimits` only constrains selected V8 memory values. A malicious skill can still use Node built-ins, access the process environment, read/write files, and potentially consume host resources.

**Impact:** Untrusted skills can compromise the host or exfiltrate secrets. This is materially different from RFC language requiring physical/process isolation.

### P0-02 — Policy lease issuance bypasses policy evaluation

**Confirmed.** With zero registered policies, `issueLease('attacker', [{ name: 'fs:write', scope: '/' }])` creates and stores a valid lease. `validateLease()` then returns `true` for that lease.

**Evidence:** `packages/policy/src/policy-engine.ts:121-139`

`evaluate()` correctly returns default deny, but `issueLease()` never calls it. The scheduler can therefore mint leases for arbitrary requested capabilities without an allow decision.

**Impact:** The policy engine is bypassed by the normal lease creation path.

### P0-03 — Executor does not generally validate task leases

**Confirmed.** A skill with no `manifest.permissions` executed successfully using an expired, revoked, or unregistered lease.

**Evidence:** `packages/executor/src/executor.ts:129-150`

Lease validation is only performed inside a loop over declared permissions. If that array is empty, no lease existence, subject, revocation, or expiry check occurs.

**Impact:** Task authorization is optional-by-manifest. A task can run without a valid lease.

### P0-04 — In-process timeout leaves the task running

**Confirmed.** A declarative/in-process skill timed out, but continued executing and performed a filesystem side effect after the executor reported timeout.

**Evidence:** `packages/executor/src/executor.ts:178-207`

The fallback path uses `Promise.race()` but cannot terminate `skill.execute()`. The worker path is terminated, but declarative skills still run in the kernel process. `releaseWorker()` is called even though the timed-out operation continues.

**Impact:** Runaway side effects, CPU/resource exhaustion, and violated worker concurrency limits.

### P0-05 — Artifact streaming bypasses integrity checks and permits path traversal

**Confirmed.**

- A corrupted durable blob was returned unchanged by `getStream()`.
- A crafted hash such as `../<file>` caused `getStream()` to open a file outside the CAS root.

**Evidence:** `packages/artifact/src/artifact-store.ts:232-241`, `:315-317`

`get()` verifies SHA-256, but durable `getStream()` directly returns `createReadStream()` without verifying the digest or validating the hash format. `casPath()` joins untrusted hash text into a filesystem path.

**Impact:** Corrupted data can reach skills, and callers with a crafted hash can read arbitrary readable files.

### P0-06 — Runtime transaction failure can leave durable state inconsistent

**Confirmed.** When `state.mutated` publication fails after the WAL append:

- the transaction returns `{ success: false }`;
- in-memory state is rolled back;
- the version remains incremented;
- the WAL still contains the command;
- a restarted instance replays the supposedly failed transaction.

**Evidence:** `packages/runtime-state/src/runtime-state.ts:190-236`

The same version-not-rolled-back problem occurs when a custom `walPersister` fails. High-level methods such as `grantLease()` and `trackPlan()` also ignore the returned `TransactionResult`.

**Impact:** Callers observe failure while recovery later resurrects the failed mutation; version/state semantics diverge.

### P0-07 — WAL replay is not atomic per record

**Confirmed.** A valid-CRC WAL record containing a valid `TRACK_PLAN` followed by an unknown command partially applied the first command before recovery stopped.

**Evidence:** `packages/runtime-state/src/runtime-state.ts:81-105`, `:270-314`

Recovery applies commands directly and catches the error only around the whole record. There is no backup/rollback for a record during replay.

**Impact:** A damaged or maliciously edited WAL can produce partial state that was never committed atomically.

### P0-08 — Scheduler accepts cyclic/invalid plans and wedges them forever

**Confirmed.** A two-node ordering cycle is accepted and remains `running` indefinitely. Invalid `maxConcurrentDispatch: 0` has the same effect.

**Evidence:** `packages/scheduler/src/scheduler.ts:139-160`, `:195-245`

`submit()` performs no plan validation, node uniqueness check, edge validation, cycle check, or configuration validation. `tick()` treats “no ready node but not all complete” as a normal state rather than a failure.

**Impact:** Plans can hang forever and retain runtime/scheduler state.

### P0-09 — Resolver accepts impossible dependency graphs

**Confirmed.**

- A consumer whose required artifact has no producer resolved successfully.
- A consumer/producers artifact cycle resolved into a cyclic plan.

**Evidence:** `packages/resolver/src/resolver.ts:157-180`, `:464-520`

Missing consumed artifacts are silently ignored. Cycle detection only examines `requires`, not artifact/data edges.

**Impact:** The scheduler receives plans that cannot execute or cannot become ready.

---

## P1 — serious correctness, lifecycle, and isolation defects

### P1-01 — EventBus ordering key includes topic

**Confirmed.** Two events with the same `event.key` but different topics were delivered in reverse/concurrent order (`b`, then `a`).

**Evidence:** `packages/event-bus/src/event-bus.ts:147-175`

The queue key is `${topic}:${event.key}`. This violates RFC-0006a's per-key ordering if that amendment is authoritative, even though the older RFC-0006 text describes per-topic ordering.

### P1-02 — EventBus can silently drop events with `maxRetries: 0`

**Confirmed.** The handler was never called, the event was not placed in the DLQ, and `publish()` resolved successfully.

**Evidence:** `packages/event-bus/src/event-bus.ts:211-228`

Invalid retry/queue options are not rejected.

### P1-03 — EventBus queue overflow leaks empty queues

**Confirmed.** With `maxQueueLengthPerKey: 0`, a rejected publish leaves an active queue entry permanently in `_keyQueues`.

**Evidence:** `packages/event-bus/src/event-bus.ts:149-164`

The queue is inserted before the capacity check, and no cleanup occurs on rejection.

### P1-04 — One failing subscriber prevents later subscribers from receiving the event

**Confirmed.** When the first subscriber exhausted retries, the second subscriber was never called.

**Evidence:** `packages/event-bus/src/event-bus.ts:206-229`

The whole dispatch loop aborts on the first subscriber error. This violates delivery to all active subscribers and loses per-subscriber failure isolation.

### P1-05 — EventBus shutdown leaves published promises pending

**Confirmed.** A queued publish remained unresolved after bounded shutdown cleared its queue.

**Evidence:** `packages/event-bus/src/event-bus.ts:71-88`

Shutdown drops queue items without resolving or rejecting their promises.

### P1-06 — EventBus DLQ is volatile despite durable-DLQ claims

**Code review.** `_deadLetterQueue` is an in-memory array and has no persistence, replay, or recovery mechanism.

**Evidence:** `packages/event-bus/src/event-bus.ts:36-49`, `:98-103`, `:199-204`

### P1-07 — Durable artifact writes are not crash-safe

**Code review.** `writeBlob()` uses `writeFileSync()` directly; index snapshots and journals are written/renamed/truncated without fsync or directory fsync.

**Evidence:** `packages/artifact/src/artifact-store.ts:323-328`, `:336-368`

A process/power failure can leave a partial blob, stale index, or an index snapshot without its corresponding durable blob.

### P1-08 — Artifact durable `putStream()` bypasses lifecycle state

**Confirmed.** A durable `putStream()` succeeds before `boot()`.

**Evidence:** `packages/artifact/src/artifact-store.ts:141-202`

Unlike `put()`, the durable streaming path has no `_isReady` guard.

### P1-09 — Artifact metadata/envelope data is mutable through returned objects

**Confirmed.** Mutating metadata on the envelope returned by `put()` changed metadata stored internally.

**Evidence:** `packages/artifact/src/artifact-store.ts:116-127`, `:246-249`

Only the outer envelope is copied; nested metadata remains shared.

### P1-10 — Artifact pins are global, not holder-scoped

**Code review.** `_pinned` is a `Set<Hash>`, and `pin()`/`unpin()` accept only a hash. One caller can unpin an artifact still needed by another caller.

**Evidence:** `packages/artifact/src/artifact-store.ts:254-268`

### P1-11 — Policy constraints are ignored

**Confirmed.** A lease granted with `{ method: 'GET' }` validated a request with `{ method: 'DELETE' }`.

**Evidence:** `packages/policy/src/policy-engine.ts:152-156`

Capability names and scopes are checked, but `constraints` are never compared.

### P1-12 — Policy expiry boundary is permissive

**Confirmed.** A lease with `expiresAt === Date.now()` remained valid because the check uses `>` instead of `>=`.

**Evidence:** `packages/policy/src/policy-engine.ts:148-150`

### P1-13 — Policy lifecycle is not enforced for lease creation

**Confirmed.** `issueLease()` succeeds after `PolicyEngine.shutdown()`.

**Evidence:** `packages/policy/src/policy-engine.ts:121-139`

### P1-14 — Runtime boot is not idempotent

**Confirmed.** Calling `boot()` twice against a persistence directory replayed the same WAL and duplicated ledger entries.

**Evidence:** `packages/runtime-state/src/runtime-state.ts:58-105`

Boot does not reset state before replay and does not reject a second boot.

### P1-15 — Runtime snapshots are not deeply immutable

**Confirmed.** Mutating nested capability constraints through a snapshot changed the live lease.

**Evidence:** `packages/runtime-state/src/runtime-state.ts:127-148`

Capabilities, constraints, metadata, and ledger payloads are only shallow-copied.

### P1-16 — Scheduler cancellation can be overwritten by failure

**Confirmed.** Cancelling an in-flight plan followed by dispatcher rejection changed its final state from `cancelled` to `failed`.

**Evidence:** `packages/scheduler/src/scheduler.ts:170-188`, `:303-319`

The rejection handler unconditionally assigns `plan.status = 'failed'`.

### P1-17 — Scheduler lease issuance failure leaves a running node/plan

**Confirmed.** If `policyEngine.issueLease()` throws, `tick()` rejects while the plan remains `running` and the node remains `running`.

**Evidence:** `packages/scheduler/src/scheduler.ts:248-263`

Lease creation happens outside the dispatcher's promise error handler.

### P1-18 — Scheduler shutdown does not drain or clean plans

**Confirmed.** `shutdown()` returned while plans remained stored and still reported `running`.

**Evidence:** `packages/scheduler/src/scheduler.ts:112-116`

It only stops accepting work and flips `_isReady`; it does not cancel, await, or clear active plans.

### P1-19 — Scheduler accepts duplicate plan IDs

**Confirmed.** Submitting a second plan with the same ID overwrote the first plan's maps and status.

**Evidence:** `packages/scheduler/src/scheduler.ts:148-153`

Existing in-flight work can then operate against replaced bookkeeping.

### P1-20 — Synchronous dispatcher errors escape `tick()` unnormalized

**Confirmed.** A dispatcher that throws synchronously caused `tick()` itself to reject, instead of transitioning the plan to `failed`.

**Evidence:** `packages/scheduler/src/scheduler.ts:281-289`

Only promise rejections returned by the dispatcher reach `.catch()`.

### P1-21 — Executor drops valid falsy results

**Confirmed.** A skill returning `0` produced zero output artifacts.

**Evidence:** `packages/executor/src/executor.ts:210-218`

`if (this._artifactStore && resultPayload)` excludes `0`, `false`, and `''`.

### P1-22 — Executor does not enforce `maxCpuPercent`

**Code review/observed behavior.** The limit is accepted in the public type but ignored. The implementation documents timeout as the only mitigation.

**Evidence:** `packages/executor/src/executor.ts:267-272`

### P1-23 — Registry active version is registration-order based

**Confirmed.** Registering `2.0.0` followed by `1.0.0` made `1.0.0` active.

**Evidence:** `packages/registry/src/registry.ts:88-98`

No SemVer comparison is performed.

### P1-24 — Registry exposes mutable internal manifests

**Confirmed.** Mutating the object returned by `getManifest()` changed the registry's stored manifest.

**Evidence:** `packages/registry/src/registry.ts:153-161`

`register()` and several index methods also use shallow copies only.

### P1-25 — Registry scan permits module paths outside the scan root

**Confirmed.** An `entryPoint` using `../` resolved to a module path outside the scanned directory.

**Evidence:** `packages/registry/src/registry.ts:224-231`

There is no containment check, existence check, checksum verification, or signature verification before the executor dynamically imports the path.

### P1-26 — Resolver ignores available artifacts and dependency version constraints

**Confirmed.**

- A producer was added even when `state.availableArtifacts` already contained the consumed artifact.
- `requiresSkillVersion` was ignored and an incompatible dependency version was selected.

**Evidence:** `packages/resolver/src/resolver.ts:139-180`, `:447-462`

The resolver also ignores optional/deprecation/minimum-AGY/signature/checksum metadata.

### P1-27 — Resolver fallback substitution retains stale security/runtime metadata

**Confirmed.** `reresolve()` replaced the skill ID but retained the failed node's old permissions and priority. It also accepted a fallback that did not produce the failed node's artifact.

**Evidence:** `packages/resolver/src/resolver.ts:344-382`

The fallback path validates only that the ID exists in the registry, not that the replacement is semantically compatible.

### P1-28 — Kernel handle state is a snapshot, not live state

**Confirmed.** After `handle.shutdown()`, `handle.state` remained `ready` while `kernel.state` was `shutdown`.

**Evidence:** `packages/kernel/src/kernel.ts:167-174`

### P1-29 — Kernel reports healthy while a subsystem is unhealthy

**Confirmed.** An unhealthy subsystem produced a kernel health status of `healthy`; health aggregation does not update `_state` to `degraded`.

**Evidence:** `packages/kernel/src/kernel.ts:122-165`

### P1-30 — Kernel permits duplicate subsystem names

**Confirmed.** Two subsystems with the same name booted; the container/health report overwrote one with the other.

**Evidence:** `packages/kernel/src/kernel.ts:38-47`, `:72-80`

---

## P2 — contract, maintainability, and operational issues

### P2-01 — CLI install does not resolve executable entry points

**Confirmed.** `skill install` accepted a manifest with `entryPoint: "skill.mjs"`, but the loaded skill had `modulePath === undefined` and therefore used the synthetic in-process declarative handler.

**Evidence:** `apps/cli/src/cli.ts:139-156`, `packages/registry/src/registry.ts:224-231`

Only directory scanning populates `modulePath`.

### P2-02 — Several public configuration options are ignored or weakly validated

Examples include:

- `KernelConfig.maxBootRetries`
- `KernelConfig.drainTimeoutMs`
- `KernelConfig.scanRoots`
- `ExecutionLimits.maxCpuPercent`
- `SchedulerOptions` values such as zero/negative/NaN concurrency and aging values
- `ExecutorOptions.maxWorkers` accepts negative values and treats `0` as the default because of `|| 10`

### P2-03 — Lifecycle methods are inconsistently guarded

Some methods reject calls before boot, while others mutate or read state after shutdown. Examples include artifact `pin`, `unpin`, `gc`, durable `putStream`, policy `issueLease`, registry `unregister`, and scheduler internal bookkeeping.

### P2-04 — Existing documentation contradicts the tested repository state

- `AGY_HANDOFF.md` says no implementation exists.
- `AUDIT_REPORT.md` describes the earlier 1.5/10 prototype.
- `IMPLEMENTATION_STATUS.md` claims 14 test suites, while the current runner executes 20.
- `IMPLEMENTATION_STATUS.md` claims formal production hardening despite the P0 findings above.

## Recommended remediation order

1. Replace worker threads with a real process/container sandbox and restrict module resolution.
2. Make lease issuance policy-authorized and require a valid, unexpired lease for every execution.
3. Validate and canonicalize all artifact hashes/paths; make `getStream()` integrity-verifying.
4. Make runtime transactions and WAL replay atomic, including version rollback and recovery validation.
5. Validate execution plans before submission and fail cyclic/stalled plans deterministically.
6. Fix EventBus subscriber isolation, shutdown settlement, option validation, and durability.
7. Rebuild resolver fallback/version/artifact semantics and refresh replacement metadata.
8. Add lifecycle/immutability guarantees and reconcile the status documents.

## Conclusion

The repository is currently **buildable and test-green under its existing tests**, but those tests do not cover the adversarial cases above. It should be considered an early functional prototype, not a production-secure autonomous kernel, until the P0 findings are addressed and converted into regression tests.
