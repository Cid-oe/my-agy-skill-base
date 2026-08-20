---
name: context-manager
description: Use during long or multi-turn tasks to decide what stays in active context versus what gets summarized or dropped, keeping the working context focused on what's currently relevant.
version: 2.0
requiresSkillVersion: ">=1.0"
category: foundation
priority: critical
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.85
escalateTo: caveman-compress
consumes:
  - ConversationState
  - BudgetReport
produces:
  - PrunedContext
requires:
  []
optional:
  - token-budget
  - checkpoint-manager
triggerPredicates:
  - "conversation_tokens > 120000"
exclusiveWith:
  []
---

# Context Manager

## Goal
Keep active context focused on what's currently relevant by pruning or summarizing stale information, rather than letting everything accumulate indefinitely.

## Orchestration Metadata
- **Priority:** critical
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.85 (below this, escalate to `caveman-compress`)

## Consumes / Produces
- **Consumes:** ConversationState, BudgetReport
- **Produces:** PrunedContext

## When to Use
- Context is getting crowded with information from completed steps
- Switching focus to a new subtask that doesn't need earlier detail
- token-budget flags usage crossing its threshold

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `conversation_tokens > 120000`

## Workflow
1. After each major step, review what's currently in context and what's still needed.
2. Summarize or discard information tied to completed or superseded steps.
3. Keep durable references (repository-map, checkpoint state) rather than raw exploration output.
4. Re-load specific details on demand rather than keeping everything 'just in case.'

## Avoid
- Dropping information that's still needed for a later step.
- Summarizing away specific facts — exact paths, exact error text, exact values — that matter later.
- Re-fetching content that was already captured in a summary.

## Success Criteria
- Context stays within budget without losing information the task still needs.
- Nothing load-bearing is lost in a summarization pass.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** token-budget, checkpoint-manager

## Works With
- token-budget
- checkpoint-manager
- repository-map
