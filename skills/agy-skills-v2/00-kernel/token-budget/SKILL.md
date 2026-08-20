---
name: token-budget
description: Use when a task may consume significant context (large repos, long conversations, multi-file refactors) to track usage and decide when to compress or checkpoint before hitting limits.
version: 2.0
requiresSkillVersion: ">=1.0"
category: foundation
priority: critical
alwaysApply: false
estimatedCost: low
estimatedLatency: fast
estimatedContext: low
confidenceThreshold: 0.9
escalateTo: context-manager
consumes:
  - ConversationState
produces:
  - BudgetReport
requires:
  []
optional:
  - checkpoint-manager
triggerPredicates:
  - "conversation_tokens > 80000"
  - "files_touched > 20"
exclusiveWith:
  []
---

# Token Budget

## Goal
Monitor token/context consumption across a task and trigger compression or checkpointing before the context window becomes a problem, instead of after.

## Orchestration Metadata
- **Priority:** critical
- **Estimated cost / latency / context:** low / fast / low
- **Confidence threshold:** 0.9 (below this, escalate to `context-manager`)

## Consumes / Produces
- **Consumes:** ConversationState
- **Produces:** BudgetReport

## When to Use
- Task involves many files or a long multi-turn conversation
- You're about to re-read large files you may have already seen
- A task has been running long enough that context feels crowded

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `conversation_tokens > 80000`
- `files_touched > 20`

## Workflow
1. Before starting, estimate roughly how much context the remaining plan will use.
2. Track usage as work progresses rather than checking only at the end.
3. When usage crosses roughly 70% of available context, hand off to context-manager (to prune/summarize) or checkpoint-manager (to save state and free the window).
4. If asked, report current budget status in concrete terms (not vague impressions).

## Avoid
- Guessing usage instead of estimating it from actual file/content sizes.
- Waiting until context is nearly full to react.
- Re-reading large files that were already summarized earlier in the task.

## Success Criteria
- Task completes without hitting a context limit mid-work.
- No redundant re-reads of content already in context.
- Budget status is answerable in concrete numbers when asked.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** checkpoint-manager

## Works With
- context-manager
- checkpoint-manager
- model-router
