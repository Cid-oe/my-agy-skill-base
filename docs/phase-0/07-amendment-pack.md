# Phase-0 Deliverable 7 — Amendment Pack (summary)

**Location:** [`docs/amendments/`](../amendments/README.md) — 14 amendments,
each with Problem / Reason / Impact / Resolution / Compatibility /
Migration. **No RFC body was edited.**

| # | Amendment | Resolves (audit IDs) | Key decisions |
|---|---|---|---|
| 1 | RFC-0001-A1 | C-01, C-16 | Planner→Resolver→Scheduler layering; escalation vacates the failed assignment before constraint-check; Resolver deps de-phantomed |
| 2 | RFC-0002-A1 | C-16, skill conformance | Optional `methods`/`tool_dependencies`/`compensations`/`retryability`/`memory_profile`; prompt-skill `entryPoint: SKILL.md`; unknown-field warnings |
| 3 | RFC-0003-A1 | C-04, C-05, C-06 | Attribute namespaces; evaluation contexts; `obligations`; `DecisionRequest` + `PolicySetVersionId`; opt-in prefix matching |
| 4 | RFC-0004-A1 | C-09, C-10, C-19 | Envelope `namespace` + bucketing; event payload ownership & name normalization; mandatory `maxDepth`; `callerContext` hook |
| 5 | RFC-0005-A1 | C-07, C-08, C-19 | `currentNodes[]`; state domains (root + child records); per-record CAS + domainRevision; watch/lease primitives; checkpoint terminology |
| 6 | RFC-0006-A1 | C-11, C-12, C-20 | Governed open namespace registry; topic grammar + alias table; `traceId`/`spanId`; RFC-0009 reference repair |
| 7 | RFC-0007-A1 | C-02, C-03, C-12, C-13 | Adopts RFC-0008 dispatch contract; `CANCELLING` state; Executor owns leases; publishes `scheduler.*` topics; references/deps corrected |
| 8 | RFC-0008-A1 | C-02, C-04, C-07, C-09 | Appendix-A assumptions conformed to published RFCs (policy mapping, artifact create/supersede, state domains); series-name fix |
| 9 | RFC-0010-A1 | C-14 | Model/token-budget ownership re-pointed (skills interim; RFC-0018/0016 canonical); Lesson schema ownership; Phase-1 tier subset normative |
| 10 | RFC-0011-A1 | C-01 | ExecutionGraph = Planner-owned task DAG consumed by Resolver; Scheduler input remains ExecutionPlan; producer-groups replace last-writer |
| 11 | RFC-0012-A1 | C-15 | Credential Store → RFC-0017; granted dependencies acknowledged; circuit-breaker gap recorded |
| 12 | RFC-0013-A1 | C-12, C-15 | Trigger topics canonical; Lesson ownership confirmed; renumbering |
| 13 | RFC-0014-A1 | C-14, C-15 | Model-routing consumer re-pointed; dependency acknowledgments; renumbering |
| 14 | RFC-0015-A1 | C-20, C-15 | Trace context granted; scheduler signals available; renumbering |

**Coupling note:** RFC-0001-A1 and RFC-0011-A1 are ratified **jointly**
(the layering is one decision seen from two sides); likewise
RFC-0007-A1/RFC-0008-A1 (one contract, two parties). Recommended
ratification: as a single bundle at **Gate G0**.

**Ratification checklist (G0):** for each amendment — Problem verified
against audit? Resolution minimal (no redesign)? Compatibility statement
true? Migration note actionable? Editor records outcome in
`docs/amendments/README.md` and RFC-0000 §6.
