import { test } from 'node:test';
import assert from 'node:assert';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createCliRuntime } from '@agy/cli';

/**
 * End-to-end: scan a real executable skill (manifest + module), resolve a goal,
 * and execute it through the full canonical runtime including the isolated
 * worker sandbox. Verifies the module's actual computed output is stored.
 */
test('Executable skill runs end-to-end through the worker sandbox', async () => {
  const examplesDir = path.resolve(process.cwd(), 'examples', 'echo-skill');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-echo-e2e-'));

  try {
    const rt = await createCliRuntime({ persistenceDir: tempDir });

    // Discover the real skill from disk (entryPoint resolved -> modulePath).
    const discovered = await rt.registry.scan([examplesDir]);
    assert.strictEqual(discovered.length, 1);
    assert.strictEqual(discovered[0].id, 'echo-skill');
    assert.ok(discovered[0].modulePath, 'scan must resolve an executable modulePath');

    // Resolve a goal the skill satisfies.
    const res = await rt.resolver.resolve(
      { id: 'echo-goal', kind: 'subtask', description: 'run echo', requiredArtifacts: ['EchoReport'] },
      rt.registry
    );
    assert.strictEqual(res.status, 'resolved');

    // Execute to completion through the scheduler -> executor -> worker.
    await rt.scheduler.submit(res.plan!);
    let status = rt.scheduler.getPlanStatus(res.plan!.planId);
    let guard = 0;
    while (status === 'running' && guard < 50) {
      await rt.scheduler.tick();
      status = rt.scheduler.getPlanStatus(res.plan!.planId);
      guard++;
    }
    assert.strictEqual(status, 'completed');

    // The skill's deterministic output is content-addressed; verify it landed.
    const expected = { skillId: 'echo-skill', report: 'EchoReport', sum: 4950 };
    const expectedHash = crypto.createHash('sha256').update(JSON.stringify(expected)).digest('hex');
    const blob = await rt.store.get(expectedHash as any);
    assert.ok(blob, 'echo-skill output artifact must be stored');
    const payload = JSON.parse(blob!.toString('utf-8'));
    assert.strictEqual(payload.sum, 4950, 'artifact must carry the real computed sum');

    await rt.kernel.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
