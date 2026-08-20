# Cavecrew

Category: execution | Priority: medium | Cost: medium | Latency: medium

**Purpose:** Split a decomposed task across independent execution passes and merge the results, instead of working through everything serially.

**Use when:** Use when a task is too large for a single execution pass but decomposes into independent, parallelizable subtasks (e.g. multi-file or multi-service changes) — coordinates several caveman-style passes instead of one long sequential one.

**Consumes:** SubtaskList  
**Produces:** MergedExecutionResult
