# AGY

AGY is an AI operating-system design composed of a kernel, a skill
ecosystem, and the RFCs that define their contracts.

## Repository layout

- `docs/` — system overview, RFCs, architecture notes, diagrams, and glossary.
- `skills/` — the versioned AGY skills package and its orchestration metadata.
- `kernel/` — implementation of the core runtime subsystems.
- `schemas/` — canonical machine-readable contracts and validation schemas.
- `examples/` — runnable examples and reference integrations.

Start with [RFC-0000](docs/RFC-0000-System-Overview.md), the documentation
entry point for system-level and subsystem RFC material.

## Development

Build artifacts (`dist/`), dependency installs (`node_modules/`), and TypeScript
incremental build state (`*.tsbuildinfo`) are **not** committed; they are ignored
via `.gitignore` and produced locally.

```sh
npm install        # install deps and link workspace packages
npm run build      # tsc -b (required before running tests)
npm test           # builds (via `pretest`) then runs every *.test.js suite
npm run typecheck  # tsc -b --noEmit
```

`npm test` always builds first, so it works from a clean checkout once
dependencies are installed.
