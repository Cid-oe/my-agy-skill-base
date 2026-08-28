---
name: subagent-chain
description: Compose multi-agent workflows (e.g. Researcher -> Implementer -> Security Reviewer -> Tester).
argument-hint: "<workflow-type> <task>"
---

# subagent-chain

Coordinates sequential and parallel subagent handoffs:
- `research_implement`: Researcher -> Implementer
- `implement_test`: Implementer -> Tester
- `security_gate`: Implementer -> Security Auditor -> Fixer
