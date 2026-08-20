# Context Manager

Category: foundation | Priority: critical | Cost: low | Latency: fast

**Purpose:** Keep active context focused on what's currently relevant by pruning or summarizing stale information, rather than letting everything accumulate indefinitely.

**Use when:** Use during long or multi-turn tasks to decide what stays in active context versus what gets summarized or dropped, keeping the working context focused on what's currently relevant.

**Consumes:** ConversationState, BudgetReport  
**Produces:** PrunedContext
