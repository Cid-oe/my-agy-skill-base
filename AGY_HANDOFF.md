# AGY handoff

## Current state (updated 2026-08-21 — Phase 0 complete; final design review issued)

**Final Design Review verdict (2026-08-21): READY WITH MINOR AMENDMENTS —
see
[`docs/architecture/2026-08-21-final-design-review.md`](docs/architecture/2026-08-21-final-design-review.md).
Conditions: ratify the A1 amendment pack **and** issue Amendment Schedule B
(B1–B11, specified in the review) as A2 amendments at Gate G0. No
architectural rework required; first code commit is authorized upon G0
completion.**

The corpus has been reconciled (Phase 0). Entry point is
[`docs/rfcs/RFC-0000.md`](docs/rfcs/RFC-0000.md): it holds the RFC status
ledger, the canonical dependency graph, numbering rules, and the future-RFC
registry (0016–0024 reserved).

- RFCs 0001–0006 are in **Review**; 0007, 0008, 0010–0015 are **Draft**
  pending ratification of their amendments; RFC-0009 is a retired number.
- The amendment pack (`docs/amendments/`) resolves the plan/dispatch/policy/
  state/event forks without rewriting any RFC. Ratifying it is **Gate G0**.
- The skill pack (`skills/agy-skills-v2/`) is conformant with RFC-0002
  (+A1): canonical layout, strict semver, ids/entryPoints, symmetric
  exclusivity. It doubles as the Registry's conformance fixture.
- Phase-0 deliverables: `docs/phase-0/01…10`.

## Where to continue

1. Ratify the amendment pack (G0), per `docs/amendments/README.md`.
2. Stabilize contracts in `schemas/` from the RFC specifications (G1).
3. Implement the kernel in `kernel/` in layer order (RFC-0000 §3):
   Registry → Resolver → Policy → Artifacts → Runtime State → Event Bus →
   Scheduler → Executor. Acceptance gates per RFC test sections
   (`docs/phase-0/10-phase-1-build-plan.md`).
4. Charter the reserved-root RFCs (0016 Resource Manager & Ledger, 0017
   Identity & Credentials, 0020 Sandbox) before Phase 2.
5. Add end-to-end examples under `examples/` as interfaces stabilize.

## Source material

- `docs/rfcs/` — RFC-0000 (entry point), RFC-0001–0008, RFC-0009
  (retirement record), RFC-0010–0015.
- `docs/amendments/` — the Phase-0 amendment pack (14 amendments).
- `skills/agy-skills-v2/` — 30 skills, manifest regenerated from
  frontmatter.
