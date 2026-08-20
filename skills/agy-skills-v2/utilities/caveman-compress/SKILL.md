---
name: caveman-compress
id: caveman-compress
description: Use when content needs to be shortened significantly — long context, verbose docs, a large output — while preserving the specific facts that matter.
version: 2.0.0
entryPoint: SKILL.md
requiresSkillVersion: ">=1.0"
category: utilities
priority: medium
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.8
escalateTo: null
consumes:
  - VerboseContent
produces:
  - CompressedContent
requires:
  []
optional:
  - context-manager
  - token-budget
triggerPredicates:
  - "content_length_tokens > 2000"
exclusiveWith:
  []
---

# Caveman Compress

## Goal
Compress verbose content down to essential facts without losing anything specific — exact numbers, names, paths, or decisions.

## Orchestration Metadata
- **Priority:** medium
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.8 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** VerboseContent
- **Produces:** CompressedContent

## When to Use
- Content is much longer than it needs to be for its purpose
- context-manager or token-budget flags something as a compression candidate
- A verbose output needs to be summarized without losing load-bearing facts

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `content_length_tokens > 2000`

## Workflow
1. Identify which specific facts must survive compression before cutting anything.
2. Cut connective and explanatory prose first.
3. Keep facts as facts — not vaguer paraphrases of them.
4. Check afterward that nothing load-bearing was cut.

## Avoid
- Summarizing away specific details to save space.
- Compressing content that's already short enough.
- Producing something so terse it becomes ambiguous.

## Success Criteria
- Output is significantly shorter with zero loss of load-bearing detail.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** context-manager, token-budget

## Works With
- context-manager
- token-budget
