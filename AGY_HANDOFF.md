# AGY handoff

## Current state

The repository contains a functional TypeScript implementation of the AGY kernel
subsystems and a 21-suite regression/adversarial test matrix. The implementation
is build- and test-green, but it is not yet a complete production security
boundary: skill execution uses restricted child processes and Node's permission
model, while container/VM-level network and OS resource isolation remain an
operational requirement.

The historical audit findings and their remediation evidence are documented in
[`ADVERSARIAL_AUDIT_REPORT.md`](ADVERSARIAL_AUDIT_REPORT.md).

## Verification

```sh
npm ci
npm run build
npm run typecheck
npm test
npm audit --audit-level=low
```

Expected result: clean build/typecheck, **21/21 test suites passing**, and zero
reported dependency vulnerabilities.

## Repository structure

- `docs/RFC-0000-System-Overview.md` — system-level entry point.
- `docs/rfcs/` — RFC-0001 through RFC-0015 and amendments.
- `schemas/` — canonical machine-readable contracts.
- `skills/agy-skills-v2/` — versioned AGY skill definitions and orchestrator.
- `packages/` — shared types, kernel, state, artifact, policy, registry,
  resolver, scheduler, executor, reflection, and testkit implementations.
- `apps/` — CLI and playground integrations.
- `tests/` — cross-subsystem, stress, simulation, and adversarial tests.

## Next priorities

1. Integrate a production container/VM sandbox with network and OS resource
   isolation around the restricted child-process executor.
2. Add signed skill distribution with a configured trust root.
3. Add multi-process operational tests for crash recovery, lock ownership, and
   filesystem failure injection.
4. Keep the RFC status, implementation ledger, and regression matrix synchronized.
