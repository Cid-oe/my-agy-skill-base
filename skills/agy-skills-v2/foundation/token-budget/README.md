# Token Budget

Category: foundation | Priority: critical | Cost: low | Latency: fast

**Purpose:** Monitor token/context consumption across a task and trigger compression or checkpointing before the context window becomes a problem, instead of after.

**Use when:** Use when a task may consume significant context (large repos, long conversations, multi-file refactors) to track usage and decide when to compress or checkpoint before hitting limits.

**Consumes:** ConversationState  
**Produces:** BudgetReport
