---
name: subagent-select
description: Deterministically select the top 2-3 most relevant subagents for a task with bounded token footprints.
argument-hint: "<task description>"
---

# subagent-select

Select the minimal optimal subagent set for a specific coding, debugging, security, or architecture task.

## Usage
```bash
python3 -c "from subagent_engine import SubagentRouter; import sys, json; r = SubagentRouter(); print(json.dumps(r.select_for_task('$ARGUMENTS', max_candidates=3), indent=2))"
```
