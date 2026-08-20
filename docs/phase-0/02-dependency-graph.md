# Phase-0 Deliverable 2 — Corrected Dependency Graph

Canonical summary lives in RFC-0000 §3; this document records the **audit**
that produced it.

## 1. Corrections applied

| Defect | Where found | Correction |
|---|---|---|
| Phantom dependency on *skills* ("Repository Map", "Context Manager") as subsystems | RFC-0001 header | Removed — data arrives via RuntimeState (RFC-0001-A1 R2) |
| RFC-0001 ↔ RFC-0005 cycle (RuntimeState type ↔ PlanNode type) | RFC-0001 §3, RFC-0005 §3 | Legalized: **type edges impose no load order**; only runtime edges do |
| RFC-0007 depends-on header lists only 0001–0003 while its text needs 0004/0005/0006/0008 | RFC-0007 header vs §7.2/§10/§11 | Header completed (RFC-0007-A1 R1) |
| RFC-0008 "extends" all of 0001–0007 while assuming non-published contracts | RFC-0008 App. A | Assumptions conformed (RFC-0008-A1); runtime deps now match published contracts |
| RFC-0010/0014 depend on phantom "0008 model routing / 0009 token budgeting" | RFC-0010 §21, RFC-0014 §6.3.6 | Re-pointed to skills interim; RFC-0016/0018 reserved (RFC-0010-A1 R1, RFC-0014-A1 R1) |
| RFC-0011 planned against a Scheduler that consumes its graph | RFC-0011 §4.1 | Re-layered: Planner→Resolver→Scheduler (RFC-0011-A1 R1/R2) |
| Scheduler/Executor mutual lease ownership | 0007 §2/§11 vs 0008 §8.6 | Executor owns leases; Scheduler keeps Reservations (RFC-0007-A1 R2/R4) |
| Event Bus producers unknown to its own allowlist | 0006 §5.1 vs 0010–0015 | Registry + grandfathered aliases (RFC-0006-A1 R1/R2) |

## 2. Canonical layer table (build/acceptance order)

See RFC-0000 §3 for the full table (L0 Registry → L9 Learning). Summary:

```
L0  0002 Registry ─ trust root
L1  0001 Resolver · 0003 Policy
L2  0004 Artifacts
L3  0005 Runtime State
L4  0006 Event Bus
L5  0007 Scheduler · 0008 Executor
L6  0010 Memory · 0012 Tool Runtime
L7  0011 Planner
L8  0013 Reflection · 0015 Observability
L9  0014 Learning
Future roots (parallel chartering): 0016 Resource Mgr · 0017 Identity ·
0018 Models · 0019 Session · 0020 Sandbox · 0021 Escalation · 0022 Bootstrap
```

## 3. Upstream/downstream edges (runtime, post-correction)

| RFC | Upstream (runtime) | Downstream (runtime consumers) |
|---|---|---|
| 0002 | — | 0001, 0003, 0004*, 0008, 0011, 0012, 0013 |
| 0001 | 0002 | 0007 (type), 0008 (resolve), 0014 (rankings read) |
| 0003 | 0002 | 0007, 0008, 0010, 0011, 0012, 0013, 0014, 0015, 0004 (future hook) |
| 0004 | 0002* | 0005, 0007, 0008, 0010, 0011, 0012, 0013, 0014, 0015 |
| 0005 | 0004 | 0007, 0008, 0010, 0011, 0012 |
| 0006 | — | all publishers/subscribers (0004, 0005, 0007, 0008, 0010–0015) |
| 0007 | 0005, 0006, 0008 (+types 0001/0003/0004) | 0010 (jobs), 0013/0014/0015 (events/records) |
| 0008 | 0001, 0002, 0003, 0004, 0005, 0006 (+type 0007) | 0013/0015 (events), 0020 (isolation, future) |
| 0010 | 0003, 0004, 0005, 0006, 0007 | 0011, 0012, 0013, 0014, 0015 |
| 0012 | 0002, 0003, 0004, 0005, 0006, 0010 | 0013, 0014, 0015 |
| 0011 | 0002, 0003, 0004, 0005, 0006, 0010 | 0001 (Goal input), 0013, 0014, 0015 |
| 0013 | 0003, 0004, 0006, 0007*, 0010, 0011, 0012 | 0014, 0015 |
| 0015 | 0003, 0004, 0006 (+ all publishers) | — (terminal consumer) |
| 0014 | 0003, 0004, 0006, 0007*, 0010, 0011, 0012, 0013 | 0001/0011/0012 (parameters, via store) |

\* signature-verification reuse; \* via artifacts/events only.

## 4. Verified properties

- **No runtime-dependency cycles** (checked by hand over §3; the only
  former cycle, 0001↔0005, is type-only).
- **Every RFC has explicit upstream and downstream** entries.
- **Pipeline order vs build order divergence** (Planner runs first, builds
  last) is documented, not hidden.
