---
name: subagent-disable
description: Manage lifecycle state (active, disabled, quarantine, deprecated) of a subagent.
argument-hint: "<subagent-id> <status>"
---

# subagent-disable

Updates subagent lifecycle state in SQLite registry:
```bash
python3 -c "from subagent_engine import SubagentRouter; r = SubagentRouter(); r.set_lifecycle_status('$1', '$2')"
```
