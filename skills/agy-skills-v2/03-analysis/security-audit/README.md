# Security Audit

Category: quality | Priority: critical | Cost: medium | Latency: medium

**Purpose:** Check code for common security issues — injection, auth/authz gaps, secret handling, unvalidated input — before it ships.

**Use when:** Use before shipping code that handles user input, auth, secrets, or external data, to check for common vulnerability classes.

**Consumes:** ExecutionResult  
**Produces:** SecurityFindings
