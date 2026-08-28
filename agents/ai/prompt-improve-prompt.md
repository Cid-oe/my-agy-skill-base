---
name: prompt-improve-prompt
description: '''Deterministic rewrite plus score card. Modes: advisory (score only), rewrite (default), rewrite_llm (gated advisory polish), rewrite_and_handoff (linter-gated).'''
kind: local
model: inherit
agy:
  version: 1.0.0
  category: ai
  tags:
  - prompt-improve.prompt
  compatibility:
    status: needs-tool-mapping
    score: 75
    notes: 'Unmapped tools: [''execute/runInTerminal''].'
  validation: passed
  imported: '2026-08-26T09:13:26+00:00'
  sources:
  - repo: ancyonio/PromptIQ
    author: ancyonio
    license: MIT
    url: https://github.com/ancyonio/PromptIQ
    path: .github/prompts/prompt-improve.prompt.md
    format: markdown-frontmatter
---

# /prompt-improve

Run the deterministic linter and rewrite engine on the ask below and return their outputs verbatim.

**Raw ask:** ${input:ask}

**Mode:** ${input:mode:rewrite} — `advisory` (T0: score card of the raw ask, no rewrite), `rewrite` (T1: score card + rewritten prompt), `rewrite_and_handoff` (T2: as `rewrite`, then execute only when the linter grants eligibility), or `rewrite_llm` (§23 gated advisory polish; see the agent).

## Procedure

1. Write the raw ask **verbatim** to a temp file outside the repository (`$env:TEMP\promptiq-ask.txt` / `${TMPDIR:-/tmp}/promptiq-ask.txt`), called `ask.txt` below, using a quoted heredoc so the shell never parses it:

   ```
   cat > "${TMPDIR:-/tmp}/promptiq-ask.txt" <<'PROMPTIQ_ASK'
   <ask>
   PROMPTIQ_ASK
   ```

   (PowerShell: `Set-Content -Encoding UTF8` to write, `Get-Content -Raw -Encoding UTF8` to pipe, with `$env:PYTHONIOENCODING='utf-8'` and UTF-8 console encodings set first — 5.1 defaults mangle non-ASCII; no `<`.) If the ask contains a `PROMPTIQ_ASK` line, choose another delimiter.

2. Score the **raw ask**: `python tools/promptiq/promptiq_lint.py --mode inline --root . --symbol-index symbol_index.json < ask.txt`. If `symbol_index.json` is absent, omit that flag in every command rather than inventing a path.
   - Mode `advisory`: emit this score card verbatim in one fenced block; stop.
   - Card shows `bypass: eligible (SPEC §11 R1)`: say `Bypassing refinement (SPEC §11 R1)`, answer the short anchored analysis ask directly; stop.

3. Rewrite, then score the rewrite (the engine is deterministic, so the re-run piped into the linter is byte-identical to the emitted rewrite):

   ```
   python tools/promptiq/promptiq_rewrite.py --root . --symbol-index symbol_index.json < ask.txt
   python tools/promptiq/promptiq_rewrite.py --root . --symbol-index symbol_index.json < ask.txt | python tools/promptiq/promptiq_lint.py --mode inline --root . --symbol-index symbol_index.json --baseline ask.txt --log
   ```

   Keep `--baseline`/`--log` — they record the token delta and §9 telemetry the K1–K4 KPIs need. Exits encode the band (0 pass, 1 repairable, 2 blocked); linter exits 1-2 and engine exit 1 (unresolved slots) are expected, not command failures. Even when the terminal marks the command as failed, never re-run, repair, or replace the printed card.

4. Emit, in order: the rewrite's score card verbatim in one fenced block, then the improved prompt verbatim in one fenced block.

5. Optionally add one section headed exactly `Model judgement (advisory — not part of the deterministic score)`, covering **only** dimensions the card lists under "still requires model judgement". No numeric score; no contradicting the linter; no edits to the blocks above.

6. Handoff: in `rewrite_and_handoff` mode, execute the improved prompt only if the card contains `handoff: eligible for T2 auto-handoff (SPEC §6)` — granted only for non-mutating archetypes at score ≥ 90 under a tier-T2 rubric. Eligibility also needs `autonomy.tier: T2` in `tools/promptiq/rubric.yaml`; the shipped `T1` default never grants it. Otherwise end with one line, e.g. `Handoff: developer approval required`. Never execute a mutating spec automatically; T3 is prohibited.

7. Stop.

## Constraints

- You are transport, not an author. Do not rewrite, polish, reorder, summarise, or extend either tool's output.
- Never pass the ask as `--text "<ask>"` — quotes, backticks, or `$(...)` in untrusted text would be parsed by the shell. Stdin from the heredoc-written temp file is the only sanctioned transport.
- Do not fill any `[NEEDS INPUT: ...]` slot; each is an unanswered developer question, and a plausible value hides a missing requirement.
- No model-authored preamble, score, or closing remark; model text is confined to the delimited Model judgement section.
- Do not modify any repository file. The temp ask file lives outside the repository.
- If either tool produces no stdout, report the stderr text and stop; never substitute a hand-written rewrite or score.
- A genuine score card always begins with the literal line `PromptIQ deterministic score:`. Never emit a card that does not start with that line; if the linter could not be run, emit no card at all.

## Acceptance criteria

- [ ] Both emitted blocks are byte-identical to the corresponding tool's stdout.
- [ ] No `[NEEDS INPUT:]` slot has been filled, removed, or reworded.
- [ ] Verification: `python tools/promptiq/promptiq_rewrite.py --check-determinism < ask.txt` reports PASS.

## Output contract

Two fenced blocks in order — (1) score card from `promptiq_lint.py`, (2) improved prompt from `promptiq_rewrite.py` — followed only by the optional delimited Model judgement section and the one-line handoff verdict. `advisory` mode: the raw-ask score card block alone.
