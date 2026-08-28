---
name: smartpackdebt-dsmh31-reviewer-1
description: Clean, well-scoped fix for a recurring class of bash quoting bugs in embedded Python blocks. The three hazardous patterns identified are real bugs (not theoretical), and the remediations are correct and idiomatic.
kind: local
model: inherit
agy:
  version: 1.0.0
  category: linux
  tags:
  - SMARTPACKDEBT-dsmh31-reviewer-1
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:00:11+00:00'
  sources:
  - repo: PeonPing/peon-ping
    author: PeonPing
    license: MIT
    url: https://github.com/PeonPing/peon-ping
    path: .gitban/agents/reviewer/inbox/SMARTPACKDEBT-dsmh31-reviewer-1.md
    format: markdown-frontmatter
---

## Summary

Clean, well-scoped fix for a recurring class of bash quoting bugs in embedded Python blocks. The three hazardous patterns identified are real bugs (not theoretical), and the remediations are correct and idiomatic.

### Fix 1: Dict bracket access (L1680-1681)

Replacing `r[\"pattern\"]` / `r[\"pack\"]` with `.get('pattern', '')` extracted to temp variables is the right fix. The `.get()` call is also more defensive than bracket access -- it avoids `KeyError` if a malformed rule entry is missing a key. Net improvement beyond just the quoting fix.

### Fix 2: Method args in f-strings (L2217-2226)

Extracting `mn.get(\"topic\", \"?\")` etc. to temp variables before using them in f-strings eliminates the double-quote nesting hazard. The resulting code is also more readable -- each value is named and the f-string is cleaner.

### Fix 3: Docstrings (L2879, L2895)

Converting `\"\"\"...\"\"\""` to `'''...'''` inside bash double-quoted strings is correct. Triple-single-quote docstrings are valid Python and avoid the escaping entirely.

### Audit completeness

Verified: `grep` for remaining `\.get(\"` and `\"\"\"` patterns in `peon.sh` returns zero matches. The claim that all hazardous patterns are remediated holds. The 30 remaining `\"` occurrences are display-string patterns (literal quotes in print output), which are POSIX-safe inside bash double-quoted strings.

### Test coverage

No new tests were added, which is acceptable here. The changes are behavior-preserving refactors (same Python semantics, safer bash quoting). Existing BATS tests cover `peon mobile status`, `packs unbind`, and state I/O paths. The `bash -n` and Python `compile()` validation in the executor log confirm syntactic correctness.

## BLOCKERS

None.

## BACKLOG

- **L1**: Consider adding a CI lint check (shellcheck custom rule or BATS test) that detects `python3 -c "` blocks containing `[\"` or `.get(\"` patterns. This would prevent regression of this bug class. The card's own "Process Improvements" section already notes this.

- **L2**: The semicolon-separated assignments on L1680 (`pat = r.get('pattern', ''); pk = r.get('pack', '')`) work but are a minor style inconsistency with the rest of the diff, which uses one-assignment-per-line. Non-blocking cosmetic item.
