# Phase-0 Deliverable 6 — Skill Audit Report

**Scope:** all 30 skills in `skills/agy-skills-v2/`.
**Method:** mechanical reconciliation of SKILL.md frontmatter ↔ manifest.json
↔ filesystem ↔ RFC-0002 rules (+A1 conventions). No skill was redesigned;
only conformance repairs.

## 1. Repairs applied

| Fix | Count | Detail |
|---|---|---|
| Directory renamed to skill id | 14 | see Deliverable 05 §1 (12 category moves + 2 utility renames) |
| Category taxonomy normalized | 30 | dirs now `foundation/execution/planning/quality/utilities`; gaps `02`,`04` eliminated |
| Manifest paths corrected | 24 | regenerated from disk (were `foundation/…` etc. against a different layout) |
| Strict semver | 30 | `2.0` → `2.0.0` (RFC-0002 §3.2 hard rule) |
| `id` added | 30 | equals `name` (satisfies id grammar `^[a-z0-9][a-z0-9-]{1,63}$`) |
| `entryPoint` added | 30 | `SKILL.md` — prompt-skill convention (RFC-0002-A1 R2) |
| `exclusiveWith` symmetry | 2 files | `caveman` now reciprocates `cavecrew` (frontmatter + prose) |
| README count corrected | 1 | 25 → 30 skills |

**Post-repair verification (scripted, all green):** every manifest path
resolves; all versions strict semver; all ids == names; all entryPoints
present; `exclusiveWith` fully symmetric; `requires`/`optional`/
`escalateTo` targets all resolve within the registry (no dangling refs).

## 2. Per-skill disposition table

Legend: DIR = directory renamed · SYM = exclusivity fixed · baseline fixes
(id/version/entryPoint/manifest path) applied to all 30 and not repeated.

| Skill | Category | Repairs | Notes |
|---|---|---|---|
| token-budget | foundation | DIR | |
| model-router | foundation | DIR | interim owner of model routing until RFC-0018 |
| checkpoint-manager | foundation | DIR | name collides with nothing post-rename (Scheduler's is "Scheduler State Snapshot") |
| repository-map | foundation | DIR | |
| context-manager | foundation | DIR | |
| caveman | execution | DIR, SYM | escalateTo ponytail now legal via RFC-0001-A1 R3 |
| cavecrew | execution | DIR | its `exclusiveWith: caveman` now reciprocated |
| gemini-skill | execution | DIR | |
| ponytail | execution | DIR | |
| prompt-coach | planning | DIR | |
| project-spec | planning | DIR | |
| task-decomposer | planning | DIR | a *skill*; kernel decomposition is RFC-0011 (glossary disambiguates) |
| architecture-review | quality | DIR | |
| caveman-review | quality | DIR | escalateTo ponytail-review legal (A1 R3) |
| dependency-audit | quality | DIR | |
| documentation-sync | quality | DIR | |
| ponytail-audit | quality | DIR | |
| ponytail-debt | quality | DIR | |
| ponytail-gain | quality | DIR | |
| ponytail-review | quality | DIR | |
| security-audit | quality | DIR | |
| self-review | quality | DIR | was hidden under `reflection-engine/` — colliding with RFC-0013's name |
| bluf | utilities | — | |
| caveman-commit | utilities | DIR | |
| caveman-compress | utilities | — | |
| caveman-help | utilities | — | |
| caveman-stats | utilities | DIR | |
| karpathy-guidelines | utilities | — | |
| ponytail-help | utilities | — | |
| skill-creator | utilities | — | |

## 3. Declared graph — validated facts

- **Consumed-but-never-produced types (11)** are *external inputs* by
  design: `RawRequest`, `Subtask`, `ConversationState`, `RepoRoot`,
  `VerifiedSubtaskResult`, `DependencyManifest`, `DraftResponse`,
  `HelpQuery`, `UsageLog`, `VerboseContent`, `RecurringTaskPattern`.
  These are RuntimeState/artifact edges originating outside the pack —
  valid, now explicitly documented.
- **Produced-but-never-consumed types (17)** including `ReviewVerdict`
  (3 producers, 0 consumers), `SecurityFindings`, `ArchitectureFindings`,
  `Checkpoint`, `PrunedContext`, `RoutingPlan`, `UpdatedDocs`. **Open
  item (skill-graph semantics, not schema):** the review/quality artifacts
  need consumers (gating rules or agent skills that read them) before the
  quality loop is closed. Tracked for Phase 1; not "fixed" here because
  inventing consumers would be redesign.

## 4. Remaining known gaps (documented, not blocking RFC-0002 validity)

1. Dead-output artifact types (above) — Phase 1 routing work.
2. Legacy `alwaysApply` field — warning-only per RFC-0002-A1 R3; retain for
   v1 tooling compatibility.
3. `checksum`/`signature` absent — permitted at `local` trust (project
   root); required before any plugin-root distribution (RFC-0023 track).
4. No `evals/` directories — RFC-0002 §19's layout anticipates them;
   populate when the Registry's eval hooks are implemented.
