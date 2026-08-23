import { test } from 'node:test';
import assert from 'node:assert';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createCliRuntime } from '@agy/cli';

/**
 * Verifies that input artifacts actually flow between skills: the summary-skill
 * consumes the echo-skill's EchoReport and its output is derived from that
 * input. If input-artifact passing were broken, summary-skill would throw and
 * the plan would fail (or produce no Summary artifact).
 */
test('Pipeline data flow: a consuming skill receives upstream output artifacts', async () => {
  const examplesDir = path.resolve(process.cwd(), 'examples');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-dataflow-'));

  try {
    const rt = await createCliRuntime({ persistenceDir: tempDir, maxWorkers: 4 });
    await rt.registry.scan([examplesDir]);

    const res = await rt.resolver.resolve(
      { id: 'dataflow-goal', kind: 'subtask', description: 'data flow', requiredArtifacts: ['Summary'] },
      rt.registry
    );
    assert.strictEqual(res.status, 'resolved');
    // 2 nodes (echo + summary) joined by a data edge.
    assert.strictEqual(res.plan!.nodes.length, 2);
    assert.ok(res.plan!.edges.some((e) => e.kind === 'data'));

    await rt.scheduler.submit(res.plan!);
    let status = rt.scheduler.getPlanStatus(res.plan!.planId);
    let guard = 0;
    while (status === 'running' && guard < 50) {
      await rt.scheduler.tick();
      status = rt.scheduler.getPlanStatus(res.plan!.planId);
      guard++;
    }
    assert.strictEqual(status, 'completed');

    // The summary output is DERIVED from the consumed echo input: echoSum mirrors
    // the echo result (4950) and doubled is 9900. Its presence proves data flowed.
    const summary = { skillId: 'summary-skill', report: 'Summary', echoSum: 4950, doubled: 9900 };
    const summaryHash = crypto.createHash('sha256').update(JSON.stringify(summary)).digest('hex');
    const blob = await rt.store.get(summaryHash as any);
    assert.ok(blob, 'summary-skill output (derived from its input) must be stored');
    const payload = JSON.parse(blob!.toString('utf-8'));
    assert.strictEqual(payload.echoSum, 4950);
    assert.strictEqual(payload.doubled, 9900);

    await rt.kernel.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
