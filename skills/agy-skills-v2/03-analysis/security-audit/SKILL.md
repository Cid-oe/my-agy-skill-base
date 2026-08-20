---
name: security-audit
description: Use before shipping code that handles user input, auth, secrets, or external data, to check for common vulnerability classes.
version: 2.0
requiresSkillVersion: ">=1.0"
category: quality
priority: critical
alwaysApply: false
estimatedCost: medium
estimatedLatency: medium
estimatedContext: medium
confidenceThreshold: 0.9
escalateTo: ponytail-review
consumes:
  - ExecutionResult
produces:
  - SecurityFindings
requires:
  []
optional:
  - dependency-audit
triggerPredicates:
  - "handles_user_input == true"
  - "handles_secrets == true"
  - "handles_auth == true"
exclusiveWith:
  []
---

# Security Audit

## Goal
Check code for common security issues — injection, auth/authz gaps, secret handling, unvalidated input — before it ships.

## Orchestration Metadata
- **Priority:** critical
- **Estimated cost / latency / context:** medium / medium / medium
- **Confidence threshold:** 0.9 (below this, escalate to `ponytail-review`)

## Consumes / Produces
- **Consumes:** ExecutionResult
- **Produces:** SecurityFindings

## When to Use
- Code handles user-supplied input
- Code touches authentication, authorization, or secrets
- Code integrates with an external/untrusted data source

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `handles_user_input == true`
- `handles_secrets == true`
- `handles_auth == true`

## Workflow
1. Identify trust boundaries — every place external input enters the system.
2. Check input validation and sanitization at each boundary.
3. Check authorization on sensitive operations, not just authentication.
4. Check secrets aren't hardcoded, logged, or exposed in error output.
5. Flag findings with severity and a concrete fix, not a generic warning.

## Avoid
- Generic 'be more secure' feedback with no specifics.
- Flagging theoretical issues with no real, describable attack path.
- Skipping this because a service is 'just internal' — internal boundaries are still boundaries.

## Success Criteria
- Findings are specific, exploitable, and paired with a concrete recommended fix.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** dependency-audit

## Works With
- dependency-audit
- ponytail-review
