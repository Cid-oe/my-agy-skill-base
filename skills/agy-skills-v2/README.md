# Agy Skills v2

30 skills across five categories (`foundation`, `execution`, `planning`,
`quality`, `utilities`), each with:

- A concrete goal, trigger conditions, ordered workflow, anti-patterns, and
  success criteria (carried over from v1).
- Machine-readable orchestration metadata in frontmatter — `id`, `version`
  (strict semver), `entryPoint`, `priority`,
  `estimatedCost`/`estimatedLatency`/`estimatedContext`,
  `confidenceThreshold` + `escalateTo`, `consumes`/`produces`,
  `requires`/`optional`, `triggerPredicates`, `exclusiveWith`, and
  `requiresSkillVersion` — conformant with RFC-0002 (see
  `docs/amendments/RFC-0002-A1.md` for the prompt-skill `entryPoint`
  convention).

See `ORCHESTRATOR.md` for how these fields compose into a resolvable
pipeline graph rather than a flat list of independently-invoked skills.

## Layout

```
<category>/<skill-id>/SKILL.md   -- full skill definition + manifest frontmatter
<category>/<skill-id>/README.md  -- one-glance summary
ORCHESTRATOR.md                  -- resolver spec / pipeline diagram
manifest.json                    -- machine-readable index of all 30 skills
                                   (regenerated from SKILL.md frontmatter;
                                    paths are relative to this directory)
```

Directory names equal skill `id`s. The manifest is derived from frontmatter —
when editing a skill, regenerate or hand-sync `manifest.json` rather than
editing paths independently.

## Categories

- **foundation** — token-budget, model-router, checkpoint-manager,
  repository-map, context-manager
- **execution** — caveman, cavecrew, gemini-skill, ponytail
- **planning** — prompt-coach, project-spec, task-decomposer
- **quality** — architecture-review, caveman-review, dependency-audit,
  documentation-sync, ponytail-audit, ponytail-debt, ponytail-gain,
  ponytail-review, security-audit, self-review
- **utilities** — bluf, caveman-commit, caveman-compress, caveman-help,
  caveman-stats, karpathy-guidelines, ponytail-help, skill-creator

## Conformance notes (Phase 0 reconciliation)

- All versions are strict semver (`2.0.0`).
- `exclusiveWith` is symmetric (`caveman ↔ cavecrew` was the one asymmetric
  pair; reciprocated in this pack).
- `escalateTo` targets that are `exclusiveWith` partners (e.g.
  `caveman → ponytail`) are valid: escalation **replaces** the failed node,
  per `docs/amendments/RFC-0001-A1.md` §R3.
- Open graph issues tracked (not fixed here, they are skill-graph semantics,
  not schema errors): `ReviewVerdict` and other produced artifact types have
  no in-pack consumer — see `docs/phase-0/06-skill-audit-report.md`.
