# AGY handoff

## Current state

The design RFCs and the v2 skill package have been consolidated into this
repository layout. The RFCs remain drafts/proposals; no kernel implementation
has been added yet.

## Where to continue

1. Treat `docs/RFC-0000-System-Overview.md` as the entry point.
2. Stabilize contracts in `schemas/` from the RFC specifications.
3. Implement core services in `kernel/` in dependency order: registry,
   resolver, policy, state, event bus, scheduler, then executor.
4. Add end-to-end examples under `examples/` as interfaces become stable.

## Source material

- `docs/rfcs/` contains RFC-0001 through RFC-0015 (RFC-0009 is not present).
- `skills/agy-skills-v2/` contains the skill definitions and manifest.
