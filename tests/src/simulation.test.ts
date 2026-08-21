import { test } from 'node:test';
import assert from 'node:assert';
import { createCliRuntime } from '@agy/cli';
import { generateSyntheticManifest } from '@agy/testkit';

test('End-to-End Autonomous Simulation: multi-skill workflow execution', async () => {
  const rt = await createCliRuntime();

  const s1 = generateSyntheticManifest('pipeline-stage1', { produces: ['Artifact-S1'] });
  const s2 = generateSyntheticManifest('pipeline-stage2', { requires: ['pipeline-stage1'], produces: ['Artifact-S2'] });
  const s3 = generateSyntheticManifest('pipeline-stage3', { requires: ['pipeline-stage2'], produces: ['Artifact-S3'] });

  await rt.registry.register(s1);
  await rt.registry.register(s2);
  await rt.registry.register(s3);

  const goal = {
    id: 'sim-goal-1',
    kind: 'subtask' as const,
    description: 'Execute multi-stage autonomous pipeline',
    requiredArtifacts: ['Artifact-S3'],
  };

  const res = await rt.resolver.resolve(goal, rt.registry);
  assert.strictEqual(res.status, 'resolved');
  assert.strictEqual(res.plan?.nodes.length, 1);

  await rt.scheduler.submit(res.plan!);
  await rt.scheduler.tick();

  const status = rt.scheduler.getPlanStatus(res.plan!.planId);
  assert.strictEqual(status, 'completed');

  await rt.kernel.shutdown();
});
