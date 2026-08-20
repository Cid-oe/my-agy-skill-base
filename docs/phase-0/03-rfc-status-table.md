# Phase-0 Deliverable 3 — RFC Status Table

Lifecycle definitions and the authoritative ledger live in RFC-0000 §5–§6.
This document records the **decisions and rationale** behind each
assignment.

| RFC | Title | Prior label | New status | Rationale |
|---|---|---|---|---|
| 0000 | Entry Point, Process & Ledger | Draft (index stub) | **Review** | Supersedes the 6-line stub; is the reconciliation baseline itself |
| 0001 | Skill Resolver | Draft | **Review** | Internally consistent; both defects (layering, escalation rule) have ratified-pending amendments; core algorithms untouched |
| 0002 | Registry & Loader | Draft | **Review** | Trust root; only additive manifest extensions pending |
| 0003 | Policy Engine | Draft | **Review** | Decision authority; additive amendments (attributes/contexts/obligations/snapshots) pending |
| 0004 | Artifact System | Draft | **Review** | Data plane; additive amendments (namespace, events, maxDepth) pending |
| 0005 | Runtime State | Draft | **Review** | Holds until RFC-0005-A1 (incl. its self-mandated `currentNodes[]` fix) is ratified — Review status explicitly conditions acceptance on that |
| 0006 | Event Bus | Draft | **Review** | Sound transport; opens its namespaces via amendment |
| 0007 | Scheduler | Draft | **Draft (hold)** | Authored against a different corpus (its own §0); needs RFC-0007-A1 ratified (references, dispatch contract, cancellation) before Review |
| 0008 | Executor | Draft for review | **Draft (hold)** | Architecture sound; must conform to published contracts via RFC-0008-A1 before Review |
| 0009 | — (slot) | absent | **Retired** | Never issued; referenced under three contradictory assumptions; permanently out of use |
| 0010 | Memory System | Proposed | **Draft (hold)** | False substrate assumptions corrected by RFC-0010-A1; then Review |
| 0011 | Planner | Proposed | **Draft (hold)** | Fork with RFC-0001 resolved by RFC-0011-A1 (jointly ratified with RFC-0001-A1); then Review |
| 0012 | Tool Runtime | Proposed | **Draft (hold)** | Minor renumbering/topic amendments; then Review |
| 0013 | Reflection Engine | Proposed | **Draft (hold)** | Trigger topics now exist (via 0007-A1); minor amendment; then Review |
| 0014 | Learning Engine | Proposed | **Draft (hold)** | Model-routing correction; then Review |
| 0015 | Observability | Proposed | **Draft (hold)** | Trace context granted (0006-A1); then Review |

**Why nothing is Accepted:** the lifecycle requires (a) an empty amendment
list and (b) schemas present in `schemas/`. Neither holds yet — both are
Gate G0/G1 outcomes of Phase 1. This is deliberate: "Accepted" must mean
*build-to-this*, and the forks only closed on paper today.

**Amendment statuses** are tracked in `docs/amendments/README.md`
(all currently **Proposed**; G0 ratifies them as a bundle).
