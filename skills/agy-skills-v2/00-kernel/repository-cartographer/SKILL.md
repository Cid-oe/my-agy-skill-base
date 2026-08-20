---
name: repository-map
description: Use when working in an unfamiliar or large codebase, before making changes, to build a concise map of structure, entry points, and key dependencies instead of exploring from scratch each time.
version: 2.0
requiresSkillVersion: ">=1.0"
category: foundation
priority: high
alwaysApply: false
estimatedCost: medium
estimatedLatency: medium
estimatedContext: medium
confidenceThreshold: 0.85
escalateTo: null
consumes:
  - RepoRoot
produces:
  - RepositoryMap
requires:
  []
optional:
  - token-budget
triggerPredicates:
  - "repository_files > 200"
  - "map_stale == true"
exclusiveWith:
  []
---

# Repository Map

## Goal
Produce a lightweight map of a codebase's structure, entry points, and key module dependencies so later work doesn't require re-exploring it.

## Orchestration Metadata
- **Priority:** high
- **Estimated cost / latency / context:** medium / medium / medium
- **Confidence threshold:** 0.85 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** RepoRoot
- **Produces:** RepositoryMap

## When to Use
- Starting work in a codebase you haven't mapped yet this session
- About to make a change and unsure where related code lives
- Structure changed enough that an existing map may be stale

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `repository_files > 200`
- `map_stale == true`

## Workflow
1. Scan the directory structure and identify entry points, config, and build files.
2. Note key modules and how they depend on each other — the map is a sketch, not a full file dump.
3. Keep the map short enough to stay cheap to hold in context.
4. Refresh only the parts that changed after a significant restructure, not the whole map.

## Avoid
- Reading every file exhaustively when a structural skim would answer the question.
- Rebuilding the map from scratch on every task instead of reusing/updating it.
- Letting the map go stale after a major refactor without noting it.

## Success Criteria
- The map answers "where does X live" and "what depends on Y" without a fresh search.
- Map stays concise — useful as a quick reference, not a second copy of the repo.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** token-budget

## Works With
- context-manager
- token-budget
- architecture-review
