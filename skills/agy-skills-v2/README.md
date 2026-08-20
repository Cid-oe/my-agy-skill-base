# Agy Skills v2

25 skills across five categories (`foundation`, `execution`, `planning`,
`quality`, `utilities`), each with:

- A concrete goal, trigger conditions, ordered workflow, anti-patterns, and
  success criteria (carried over from v1).
- **New in v2:** machine-readable orchestration metadata in frontmatter —
  `priority`, `estimatedCost`/`estimatedLatency`/`estimatedContext`,
  `confidenceThreshold` + `escalateTo`, `consumes`/`produces`,
  `requires`/`optional`, `triggerPredicates`, `exclusiveWith`, and
  `requiresSkillVersion`.

See `ORCHESTRATOR.md` for how these fields compose into a resolvable
pipeline graph rather than a flat list of independently-invoked skills.

## Layout

```
<category>/<skill-name>/SKILL.md   -- full skill definition + metadata
<category>/<skill-name>/README.md  -- one-glance summary
ORCHESTRATOR.md                    -- resolver spec / pipeline diagram
manifest.json                      -- machine-readable index of all 25 skills
```

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
