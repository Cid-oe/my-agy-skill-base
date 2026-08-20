# Model Router

Category: foundation | Priority: critical | Cost: low | Latency: fast

**Purpose:** Route each subtask to the least expensive model/tool capable of doing it correctly, rather than defaulting every subtask to the most powerful option.

**Use when:** Use when a task could be handled by different models or tools (e.g. a lightweight model, a stronger model, or Gemini) at different cost/capability tradeoffs, to route each subtask to the cheapest one that can actually do it.

**Consumes:** SubtaskList  
**Produces:** RoutingPlan
