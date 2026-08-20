# Phase-0 Deliverable 5 — Canonical Repository Layout

Canonical statement lives in RFC-0000 §7. This document records **what
changed in Phase 0** and the rules that keep it canonical.

## Changes applied this phase

1. **Skill pack re-canonicalized** (`skills/agy-skills-v2/`):
   old numbered/mismatched taxonomy → `foundation/ execution/ planning/
   quality/ utilities/` with directory names == skill ids:
   - `00-kernel/{checkpoint-engine→foundation/checkpoint-manager,
     context-engine→context-manager, model-orchestrator→model-router,
     repository-cartographer→repository-map, token-budget→foundation/token-budget}`
   - `01-planning/{prompt-engineer→prompt-coach, spec-generator→project-spec,
     task-architect→task-decomposer}`
   - `03-analysis/* → quality/*` (incl. `reflection-engine → self-review`)
   - `05-agents/{caveman, multi-agent-orchestrator→cavecrew,
     gemini-bridge→gemini-skill, ponytail} → execution/*`
   - `utilities/{commit-generator→caveman-commit, developer-stats→caveman-stats}`
2. **New directories:** `docs/amendments/` (14 amendments + index),
   `docs/phase-0/` (this set), `docs/adr/` (empty, implementation-time),
   `tests/` (empty, Phase-1 conformance suites).
3. **New documents:** `docs/rfcs/RFC-0000.md` (entry point),
   `docs/rfcs/RFC-0009.md` (retirement record);
   `docs/RFC-0000-System-Overview.md` reduced to a redirect stub.
4. **Regenerated:** `skills/agy-skills-v2/manifest.json` (derived from
   frontmatter — see rule below); READMEs and `AGY_HANDOFF.md` updated.

## Canonical tree

```
AGY/
├── README.md                        repo orientation
├── AGY_HANDOFF.md                   current-state handoff (editor-maintained)
├── docs/
│   ├── rfcs/RFC-0000.md             ENTRY POINT: process, ledger, graph, registry
│   ├── rfcs/RFC-0001..0008,0010..0015 .md   subsystem specs
│   ├── rfcs/RFC-0009.md             number-retirement record
│   ├── amendments/                  RFC-00NN-Ax.md + README index
│   ├── adr/                         AD-00NN-title.md (implementation decisions)
│   ├── architecture/                reviews & analyses (2026-08-20 review)
│   ├── phase-0/                     deliverables 01–10 (this set)
│   ├── diagrams/                    diagram sources/exports
│   └── glossary.md                  canonical terminology + synonym map
├── schemas/                         machine-readable contracts (Gate G1)
│   ├── manifest/  artifacts/  events/  policy/  state/
├── skills/agy-skills-v2/            the skill package (conformance fixture)
│   └── <category>/<skill-id>/{SKILL.md, README.md}
├── kernel/                          Phase-1+ implementation, one package per layer
├── tests/                           cross-kernel conformance / determinism / golden
└── examples/                        runnable reference integrations
```

## Invariants (enforced by review, later by CI)

- `manifest.json` is **derived** from SKILL.md frontmatter; regenerate, never
  hand-edit paths.
- Skill directory name == skill `id`; category directory ∈ {foundation,
  execution, planning, quality, utilities}.
- RFC filenames are `RFC-00NN.md`; numbers never reused; amendments in
  `docs/amendments/` only.
- `schemas/` is authoritative for shapes once its parent RFC is Accepted;
  until then the RFC text plus its ratified amendments govern.
- No document outside `docs/rfcs/` may declare RFC status.
