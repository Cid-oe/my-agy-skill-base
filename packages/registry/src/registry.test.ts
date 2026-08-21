import { test } from 'node:test';
import assert from 'node:assert';
import { SkillRegistry } from './registry.js';
import { SkillLoader } from './loader.js';
import { EventBus } from '@agy/event-bus';
import { SkillManifest } from '@agy/shared';

const sampleManifest: SkillManifest = {
  id: 'security-audit',
  name: 'Security Audit',
  version: '2.0.0',
  description: 'Audits code changes for security vulnerabilities',
  priority: 'high',
  requires: [],
  optional: [],
  consumes: ['DiffArtifact'],
  produces: ['SecurityReport'],
  exclusiveWith: [],
  confidenceThreshold: 0.85,
  triggerPredicates: [],
  permissions: [{ name: 'fs:read', scope: '/project' }],
  capabilities: ['security', 'analysis'],
  entryPoint: 'src/index.ts',
};

test('SkillRegistry registers manifest and maintains inverted indices', async () => {
  const bus = new EventBus();
  await bus.boot();

  const registry = new SkillRegistry({ eventBus: bus });
  await registry.boot();

  const handle = await registry.register(sampleManifest);
  assert.strictEqual(handle.id, 'security-audit');
  assert.strictEqual(handle.version, '2.0.0');

  // Verify findByProduces inverted index
  const producers = registry.findByProduces('SecurityReport');
  assert.strictEqual(producers.length, 1);
  assert.strictEqual(producers[0].id, 'security-audit');

  // Verify findByCapability inverted index
  const secSkills = registry.findByCapability('security');
  assert.strictEqual(secSkills.length, 1);

  await registry.shutdown();
  await bus.shutdown();
});

test('SkillLoader loads and executes skill instances with drain lifecycle', async () => {
  const registry = new SkillRegistry();
  await registry.boot();
  await registry.register(sampleManifest);

  const loader = new SkillLoader({ registry });
  await loader.boot();

  const loaded = await loader.load('security-audit');
  assert.strictEqual(loaded.handle.lifecycleState, 'loaded');

  const result = (await loaded.execute({ test: 123 })) as { skillId: string };
  assert.strictEqual(result.skillId, 'security-audit');

  // Hot reload dual-host drain protocol
  const reloaded = await loader.reload('security-audit');
  assert.strictEqual(reloaded.handle.lifecycleState, 'loaded');

  await loader.shutdown();
  await registry.shutdown();
});
