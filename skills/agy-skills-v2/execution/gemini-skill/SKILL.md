---
name: gemini-skill
id: gemini-skill
description: Use when a specific subtask is genuinely better suited to Gemini — very large context ingestion, multimodal input, or an explicit user request to use it — rather than routing every subtask there by default.
version: 2.0.0
entryPoint: SKILL.md
requiresSkillVersion: ">=1.0"
category: execution
priority: low
alwaysApply: false
estimatedCost: medium
estimatedLatency: medium
estimatedContext: high
confidenceThreshold: 0.75
escalateTo: model-router
consumes:
  - Subtask
produces:
  - ValidatedExternalResult
requires:
  []
optional:
  - context-manager
triggerPredicates:
  - "context_required_tokens > 500000"
  - "input_modality != text"
exclusiveWith:
  []
---

# Gemini Delegate

## Goal
Delegate a specific, well-justified subtask to Gemini and validate the result before integrating it back into the task.

## Orchestration Metadata
- **Priority:** low
- **Estimated cost / latency / context:** medium / medium / high
- **Confidence threshold:** 0.75 (below this, escalate to `model-router`)

## Consumes / Produces
- **Consumes:** Subtask
- **Produces:** ValidatedExternalResult

## When to Use
- The subtask needs a much larger context window than is practical otherwise
- The subtask is multimodal (image/video/audio) in a way that's Gemini's strength
- The user explicitly asked for Gemini

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `context_required_tokens > 500000`
- `input_modality != text`

## Workflow
1. Confirm the subtask genuinely benefits from Gemini rather than defaulting to it out of convenience.
2. Prepare a self-contained prompt with everything Gemini needs (it won't have your accumulated repo context unless you give it).
3. Call it and get the result.
4. Validate the returned output against the subtask's actual requirements before accepting it — don't pass it through unchecked.

## Avoid
- Routing here just because it's available, not because it's the better tool for this subtask.
- Accepting Gemini's output without validating it against the requirement.
- Using it for subtasks that need tight repo context it wasn't given.

## Success Criteria
- The choice to use Gemini was actually justified by the subtask's needs.
- Output is validated before being integrated, not trusted blindly.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** context-manager

## Works With
- model-router
- context-manager
