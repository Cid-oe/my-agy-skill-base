---
name: skill-creator
description: Use when a new recurring task or workflow would benefit from its own skill — to draft a properly structured, fully filled-in SKILL.md rather than a placeholder template.
version: 2.0
requiresSkillVersion: ">=1.0"
category: utilities
priority: low
alwaysApply: false
estimatedCost: medium
estimatedLatency: medium
estimatedContext: low
confidenceThreshold: 0.8
escalateTo: null
consumes:
  - RecurringTaskPattern
produces:
  - NewSkillDefinition
requires:
  []
optional:
  - caveman-help
  - ponytail-help
triggerPredicates:
  - "task_recurrence_detected == true"
exclusiveWith:
  []
---

# Skill Creator

## Goal
Create new skills with real, specific content — a clear goal, a concrete trigger description, and workflow steps written for that skill's actual job, not a copied template.

## Orchestration Metadata
- **Priority:** low
- **Estimated cost / latency / context:** medium / medium / low
- **Confidence threshold:** 0.8 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** RecurringTaskPattern
- **Produces:** NewSkillDefinition

## When to Use
- A task keeps recurring and would benefit from being made repeatable
- An existing skill's placeholder content needs to be replaced with something real
- Considering whether something warrants a new skill at all

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `task_recurrence_detected == true`

## Workflow
1. Confirm the task is actually recurring or generalizable — not a one-off that doesn't need a skill.
2. Write the trigger description first — this is what makes the skill discoverable, and it's the field most templates skip.
3. Write a goal specific to this skill's actual job, not a generic restatement.
4. Write workflow steps concrete to this task — not the generic 'Analyze/Plan/Execute/Verify/Escalate' skeleton copied unmodified.
5. List only skills it genuinely depends on under 'works with,' not a copy-pasted default set.

## Avoid
- Filling in generic placeholder text ('Describe the objective of this skill').
- Copying another skill's workflow steps verbatim without adapting them.
- Listing 'works with' skills that were just copied from another file rather than genuinely relevant.

## Success Criteria
- The resulting SKILL.md is specific enough that someone could execute the skill from the file alone.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** caveman-help, ponytail-help

## Works With
- caveman-help
- ponytail-help
