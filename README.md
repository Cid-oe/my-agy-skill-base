# AGY

AGY is an AI operating-system design composed of a kernel, a skill
ecosystem, and the RFCs that define their contracts.

## Repository layout

- `docs/` — RFCs, amendments, ADRs, glossary, reviews, and Phase-0 deliverables.
- `skills/` — the versioned AGY skills package (RFC-0002-conformant; manifest derived from frontmatter).
- `kernel/` — implementation of the core runtime subsystems (Phase 1+, layer order per RFC-0000 §3).
- `schemas/` — canonical machine-readable contracts and validation schemas.
- `examples/` — runnable examples and reference integrations.
- `tests/` — cross-kernel conformance, determinism, and golden suites.

Start with [RFC-0000](docs/rfcs/RFC-0000.md) — the specification entry
point: RFC process, status ledger, dependency graph, and roadmap.

Phase-0 reconciliation deliverables live in [docs/phase-0/](docs/phase-0/);
the amendment pack lives in [docs/amendments/](docs/amendments/README.md).
