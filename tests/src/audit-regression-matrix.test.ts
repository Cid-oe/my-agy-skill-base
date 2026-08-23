import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

type MatrixRow = {
  finding: string;
  severity: string;
  status: string;
  evidence: string;
  notes: string;
};

function parseRows(markdown: string): MatrixRow[] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('| CRIT-') || line.startsWith('| HIGH-'))
    .map((line) => {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
      assert.strictEqual(cells.length, 5, `matrix row must have 5 cells: ${line}`);
      const [finding, severity, status, evidence, notes] = cells;
      return { finding, severity, status, evidence, notes };
    });
}

test('Audit regression matrix covers every Critical and High finding', () => {
  const matrixPath = path.resolve(process.cwd(), 'docs', 'audit-regression-matrix.md');
  const markdown = fs.readFileSync(matrixPath, 'utf-8');
  const rows = parseRows(markdown);

  const expectedCritical = Array.from({ length: 8 }, (_, i) => `CRIT-${String(i + 1).padStart(2, '0')}`);
  const expectedHigh = Array.from({ length: 7 }, (_, i) => `HIGH-${String(i + 1).padStart(2, '0')}`);
  const byFinding = new Map(rows.map((row) => [row.finding, row]));

  for (const finding of expectedCritical) {
    const row = byFinding.get(finding);
    assert.ok(row, `${finding} must be present in audit-regression-matrix.md`);
    assert.strictEqual(row.severity, 'Critical', `${finding} must keep Critical severity`);
    assert.match(row.status, /^Fixed/, `${finding} must be fixed, not deferred`);
    assert.match(row.evidence, /\.test\.ts/, `${finding} must map to at least one regression test`);
  }

  for (const finding of expectedHigh) {
    const row = byFinding.get(finding);
    assert.ok(row, `${finding} must be present in audit-regression-matrix.md`);
    assert.strictEqual(row.severity, 'High', `${finding} must keep High severity`);
    assert.match(
      row.status,
      /^(Fixed|Accepted technical debt)/,
      `${finding} must be either fixed or explicitly accepted as technical debt`
    );
    assert.ok(
      row.evidence.includes('.test.ts') || row.evidence.toLowerCase().includes('accepted'),
      `${finding} must have regression evidence or accepted-debt evidence`
    );
    assert.ok(row.notes.length > 0, `${finding} must include rationale notes`);
  }
});
