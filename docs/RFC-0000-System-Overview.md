# RFC-0000: System Overview

**Status:** Draft  
**Scope:** AGY architecture and document map

## Purpose

AGY is an AI operating-system architecture for safely selecting, loading,
authorizing, scheduling, executing, and learning from reusable skills. It
separates durable system contracts from individual skill implementations.

## System layers

1. **Skills** provide declarative capabilities, metadata, dependencies, and
   executable entry points.
2. **Kernel** provides the trusted runtime: skill registry and resolver,
   policy enforcement, artifacts, runtime state, eventing, scheduling, and
   execution.
3. **Supporting services** extend the runtime with memory, planning, tool
   access, reflection, learning, and observability.
4. **Schemas and examples** turn the written contracts into validated,
   interoperable implementations.

## RFC map

| Area | RFCs |
| --- | --- |
| Skill discovery and selection | RFC-0001 Skill Resolver; RFC-0002 Skill Registry & Loader |
| Core runtime | RFC-0003 Policy Engine; RFC-0004 Artifact System; RFC-0005 Runtime State; RFC-0006 Event Bus; RFC-0007 Scheduler; RFC-0008 Executor |
| Intelligence and extension | RFC-0010 Memory System; RFC-0011 Planner; RFC-0012 Tool Runtime; RFC-0013 Reflection Engine; RFC-0014 Learning Engine; RFC-0015 Observability |

RFC-0009 is currently unassigned.

## Repository conventions

- Put normative subsystem decisions in `docs/rfcs/`.
- Keep diagrams in `docs/diagrams/` and supporting architecture notes in
  `docs/architecture/`.
- Place canonical validation contracts in `schemas/`.
- Implement runtime code in `kernel/`; do not embed kernel behavior in skill
  packages.
