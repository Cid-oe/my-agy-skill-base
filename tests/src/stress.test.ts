import { test } from 'node:test';
import assert from 'node:assert';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createCliRuntime } from '@agy/cli';

/**
 * Stress harness: resolve and execute many concurrent multi-node plans
 * (echo-skill -> summary-skill via a data edge) through the full runtime,
 * exercising the worker pool, isolation, scheduler concurrency, and the
 * artifact store under load.
 */
test('Stress: many concurrent 2-node plans complete with no worker-slot leaks', async () => {
  const examplesDir = path.resolve(process.cwd(), 'examples');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-stress-'));

  try {
    const POOL = 8;
    const PLANS = 25;
    const rt = await createCliRuntime({ persistenceDir: tempDir, maxWorkers: POOL });

    const discovered = await rt.registry.scan([examplesDir]);
    const ids = discovered.map((m) => m.id).sort();
    assert.deepStrictEqual(ids, ['echo-skill', 'summary-skill'].sort());

    // Pre-compute expected content hashes for both skills' deterministic outputs.
    const echoHash = crypto.createHash('sha256')
      .update(JSON.stringify({ skillId: 'echo-skill', report: 'EchoReport', sum: 4950 }))
      .digest('hex');
    const summaryHash = crypto.createHash('sha256')
      .update(JSON.stringify({ skillId: 'summary-skill', report: 'Summary', total: 9900 }))
      .digest('hex');

    const planIds: string[] = [];
    for (let i = 0; i < PLANS; i++) {
      const res = await rt.resolver.resolve(
        { id: `stress-goal-${i}`, kind: 'subtask', description: 'stress', requiredArtifacts: ['Summary'] },
        rt.registry
      );
      assert.strictEqual(res.status, 'resolved');
      // Each plan must be the 2-node data pipeline.
      assert.strictEqual(res.plan!.nodes.length, 2);
      assert.ok(
        res.plan!.edges.some((e) => e.kind === 'data'),
        'plan must contain the echo -> summary data edge'
      );
      await rt.scheduler.submit(res.plan!);
      planIds.push(res.plan!.planId);
    }

    // Drive all plans to a terminal state.
    const start = Date.now();
    let guard = 0;
    let pending = PLANS;
    while (pending > 0 && guard < 5000) {
      await rt.scheduler.tick();
      pending = planIds.filter((id) => rt.scheduler.getPlanStatus(id as any) === 'running').length;
      guard++;
    }
    const elapsed = Date.now() - start;

    // Every plan must have completed successfully.
    for (const id of planIds) {
      assert.strictEqual(rt.scheduler.getPlanStatus(id as any), 'completed');
    }

    // Both deterministic outputs must be present (content-addressed).
    assert.ok(await rt.store.get(echoHash as any), 'echo-skill output must be stored');
    assert.ok(await rt.store.get(summaryHash as any), 'summary-skill output must be stored');

    // The worker pool must fully drain (no slot leaks under load).
    assert.strictEqual(rt.executor.getPoolStatus().activeWorkers, 0, 'no workers should remain active');

    const throughput = (PLANS / elapsed) * 1000;
    console.log(`stress: ${PLANS} plans (2 nodes each) across a pool of ${POOL} in ${elapsed}ms (~${throughput.toFixed(1)} plans/s)`);

    await rt.kernel.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
