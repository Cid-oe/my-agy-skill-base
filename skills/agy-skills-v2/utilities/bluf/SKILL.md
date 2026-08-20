---
name: bluf
description: Use when a response could bury the key answer under preamble or reasoning — lead with the bottom line first, supporting detail after.
version: 2.0
requiresSkillVersion: ">=1.0"
category: utilities
priority: low
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.8
escalateTo: null
consumes:
  - DraftResponse
produces:
  - ReorderedResponse
requires:
  []
optional:
  []
triggerPredicates:
  - "response_paragraphs > 2"
  - "direct_question == true"
exclusiveWith:
  []
---

# BLUF (Bottom Line Up Front)

## Goal
Put the conclusion or direct answer first, then supporting detail — never bury the lede in setup, caveats, or process narration.

## Orchestration Metadata
- **Priority:** low
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.8 (no escalation target — terminal skill)

## Consumes / Produces
- **Consumes:** DraftResponse
- **Produces:** ReorderedResponse

## When to Use
- A response is building up to an answer through several paragraphs of reasoning first
- The person asked a direct question that has a direct answer
- Preamble ('great question,' 'let me think about this') is about to precede the actual answer

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `response_paragraphs > 2`
- `direct_question == true`

## Workflow
1. Write the conclusion or direct answer as the first line.
2. Follow with supporting reasoning or detail only if it's actually useful.
3. Cut throat-clearing entirely — no 'great question,' no restating the question back.

## Avoid
- Leading with process narration instead of the answer.
- Adding detail the person didn't ask for just to seem thorough.
- Being terse to the point of dropping a caveat that actually matters.

## Success Criteria
- The reader gets the answer in the first sentence.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** none

## Works With
- caveman
