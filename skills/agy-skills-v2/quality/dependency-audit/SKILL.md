---
name: dependency-audit
id: dependency-audit
description: Use before adding a new dependency, or periodically on an existing project, to check for known vulnerabilities, unmaintained packages, and unnecessary bloat.
version: 2.0.0
entryPoint: SKILL.md
requiresSkillVersion: ">=1.0"
category: quality
priority: high
alwaysApply: false
estimatedCost: medium
estimatedLatency: medium
estimatedContext: low
confidenceThreshold: 0.85
escalateTo: security-audit
consumes:
  - DependencyManifest
produces:
  - DependencyFindings
requires:
  []
optional:
  - security-audit
triggerPredicates:
  - "new_dependency_added == true"
  - "periodic_scan == true"
exclusiveWith:
  []
---

# Dependency Audit

## Goal
Check dependencies — new or existing — for known vulnerabilities, staleness, and whether they're actually necessary.

## Orchestration Metadata
- **Priority:** high
- **Estimated cost / latency / context:** medium / medium / low
- **Confidence threshold:** 0.85 (below this, escalate to `security-audit`)

## Consumes / Produces
- **Consumes:** DependencyManifest
- **Produces:** DependencyFindings

## When to Use
- About to add a new package
- Periodic check on an existing project's dependency tree
- security-audit flags a dependency as a possible attack surface

### Automatic Trigger Predicates
Machine-checkable conditions an orchestrator can evaluate without prompt matching:
- `new_dependency_added == true`
- `periodic_scan == true`

## Workflow
1. List current or proposed dependencies, including transitive ones where relevant.
2. Check for known CVEs against current versions.
3. Check last-maintained date and general project health.
4. Check for unused or duplicate dependencies already in the tree.
5. Flag anything risky with the specific reason, not a general warning.

## Avoid
- Flagging a dependency with no concrete reason ('older version' alone isn't a finding).
- Ignoring transitive dependencies.
- Recommending a dependency for something a few lines of code would do just as well.

## Success Criteria
- Risky dependencies are identified with specifics — CVE, staleness date, or concrete redundancy.
- No vague warnings without an actionable next step.

## Dependencies
- **Requires (hard):** none
- **Optional (soft):** security-audit

## Works With
- security-audit
- architecture-review
