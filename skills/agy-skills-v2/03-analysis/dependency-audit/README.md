# Dependency Audit

Category: quality | Priority: high | Cost: medium | Latency: medium

**Purpose:** Check dependencies — new or existing — for known vulnerabilities, staleness, and whether they're actually necessary.

**Use when:** Use before adding a new dependency, or periodically on an existing project, to check for known vulnerabilities, unmaintained packages, and unnecessary bloat.

**Consumes:** DependencyManifest  
**Produces:** DependencyFindings
