# Tests

Cross-kernel suites, gated per the Phase-1 build plan
(`docs/phase-0/10-phase-1-build-plan.md`):

- **conformance/** — each RFC's specified suites as that subsystem lands
  (e.g. RFC-0002 §17, RFC-0001 §11, RFC-0003 §15 …).
- **determinism/** — golden plans, golden decisions, dispatch-order replay,
  executor control-plane replay.
- **fixtures/skills/** — synthetic 10k-skill catalog generator + the real
  `skills/agy-skills-v2/` pack as the Registry conformance fixture.
- **lint/** — frontmatter validation, manifest↔disk reconciliation
  (productized from the Phase-0 scripts).

Nothing lives here yet (Phase 1, Stage 0.3).
