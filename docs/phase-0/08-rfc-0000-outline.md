# Phase-0 Deliverable 8 — RFC-0000 Outline

RFC-0000 has been **authored** (not just outlined) at
[`docs/rfcs/RFC-0000.md`](../rfcs/RFC-0000.md) — it supersedes the former
index stub (`docs/RFC-0000-System-Overview.md`, now a redirect). The
outline below maps requirements → sections.

| Required content | RFC-0000 section |
|---|---|
| Vision | §1 — vision + the six corpus-wide design invariants |
| Architecture | §2 — kernel/platform/cognition-loop diagram + runtime pipeline order |
| Dependency graph | §3 — canonical layer table, runtime vs type edges, graph rules |
| Glossary | §10 → `docs/glossary.md` (canonical + legacy synonym map) |
| RFC process | §5 — lifecycle (Draft/Review/Accepted/Implemented/Superseded/Deprecated/Archived), amendment mechanics |
| Status definitions | §5.1 table (entry criteria per status) |
| Status ledger | §6 — authoritative per-RFC status + open items |
| Repository structure | §7 — canonical tree |
| Naming conventions | §7 — RFC/ADR/event/artifact/skill naming rules |
| Subsystem map | §4 — one-line charters + owned contracts per RFC |
| Roadmap | §9 — Phases 0–4 |
| Numbering authority | §5.2 + §8 — allocation-only rule; reserved 0016–0024; unassigned pool |

**Deliberate scope limits (no gold-plating):** RFC-0000 contains no
subsystem design, no requirements on unreserved numbers, and no diagrams
beyond ASCII (diagrams belong in `docs/diagrams/` once Phase 1 starts).
