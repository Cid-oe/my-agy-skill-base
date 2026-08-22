import { test } from 'node:test';
import assert from 'node:assert';
import { createCliRuntime } from '@agy/cli';
import { generateSyntheticManifest } from '@agy/testkit';

/**
 * End-to-end autonomous simulation: a multi-stage pipeline (S1 -> S2 -> S3)
 * is resolved, scheduled, and executed through the full canonical runtime.
 *
 * This test is part of the build graph (root tsconfig references ./tests) and
 * is executed by `npm test`. It previously asserted nodes.length === 1, which
 * encoded the pre-transitive-expansion resolver behavior; the resolver now
 * expands transitive `requires` (see resolver "transitive pipeline" test), so a
 * 3-stage chain yields 3 plan nodes. It also drives the pull-based scheduler
 * to completion rather than a single tick.
 */
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
  // Transitive expansion of stage3 -> stage2 -> stage1 produces 3 nodes.
  assert.strictEqual(res.plan?.nodes.length, 3);

  await rt.scheduler.submit(res.plan!);
  // The scheduler is pull-based: advance until the plan reaches a terminal state.
  let status = rt.scheduler.getPlanStatus(res.plan!.planId);
  let guard = 0;
  while (status === 'running' && guard < 100) {
    await rt.scheduler.tick();
    status = rt.scheduler.getPlanStatus(res.plan!.planId);
    guard++;
  }
  assert.strictEqual(status, 'completed');

  await rt.kernel.shutdown();
});
