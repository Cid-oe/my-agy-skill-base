# Checkpoint Manager

Category: foundation | Priority: high | Cost: low | Latency: fast

**Purpose:** Persist enough state — what's done, what decisions were made, what's left — at sensible intervals so a task can resume without repeating verified work.

**Use when:** Use during long-running or multi-step tasks to save progress at safe points, so work can resume cleanly after an interruption instead of redoing completed steps.

**Consumes:** VerifiedSubtaskResult  
**Produces:** Checkpoint
