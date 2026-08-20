# Ponytail Gain

Category: quality | Priority: medium | Cost: low | Latency: fast

**Purpose:** Record when technical debt is actually paid down, closing out the corresponding ledger entries — and note any new debt the fix introduced.

**Use when:** Use after work that pays down technical debt — refactors, fixing workarounds, removing deferred TODOs — to record the paydown against the ponytail-debt ledger.

**Consumes:** ExecutionResult, DebtLedger  
**Produces:** PaydownRecord
