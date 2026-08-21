import { test } from 'node:test';
import assert from 'node:assert';
import { SkillRegistry } from '@agy/registry';
import { SkillResolver } from '@agy/resolver';
import { generateSyntheticCatalog } from '@agy/testkit';

test('Scale Benchmark: Resolves against 1,000 synthetic skills in under 50ms', async () => {
  const registry = new SkillRegistry();
  await registry.boot();

  const catalog = generateSyntheticCatalog(1000);
  for (const manifest of catalog) {
    await registry.register(manifest);
  }

  const resolver = new SkillResolver();
  await resolver.boot();

  const start = performance.now();
  const result = await resolver.resolve(
    {
      id: 'scale-goal',
      kind: 'subtask',
      description: 'Resolve in 1000 skill catalog',
      requiredArtifacts: ['Artifact-500'],
    },
    registry
  );
  const duration = performance.now() - start;

  assert.strictEqual(result.status, 'resolved');
  assert.strictEqual(result.plan?.nodes[0].skillRef.id, 'skill-500');
  assert.strictEqual(duration < 50, true, `Resolution took ${duration}ms, expected < 50ms`);

  await resolver.shutdown();
  await registry.shutdown();
});
