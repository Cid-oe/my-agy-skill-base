# Architecture Review

Category: quality | Priority: high | Cost: medium | Latency: medium

**Purpose:** Catch structural and design problems — wrong layer boundaries, unnecessary coupling, duplicated abstractions — before they're baked in.

**Use when:** Use after significant structural changes — new modules, changed data flow, new dependencies between components — to check the design against the existing architecture before it's finalized.

**Consumes:** RepositoryMap, ExecutionResult  
**Produces:** ArchitectureFindings
