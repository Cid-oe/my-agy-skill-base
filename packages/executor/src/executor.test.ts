import { test } from 'node:test';
import assert from 'node:assert';
import { Executor } from './executor.js';
import { SkillRegistry, SkillLoader } from '@agy/registry';
import { ArtifactStore } from '@agy/artifact';
import { EventBus } from '@agy/event-bus';
import { ICancellationToken, SkillManifest, TaskContext } from '@agy/shared';

const sampleSkill: SkillManifest = {
  id: 'unit-tester',
  name: 'Unit Tester',
  version: '1.0.0',
  description: 'Executes test suites',
  priority: 'high',
  requires: [],
  optional: [],
  consumes: [],
  produces: ['TestResults'],
  exclusiveWith: [],
  confidenceThreshold: 0.9,
  triggerPredicates: [],
  permissions: [],
  capabilities: ['testing'],
  entryPoint: 'test.ts',
};

test('Executor executes tasks, bounds worker concurrency, and produces artifacts', async () => {
  const bus = new EventBus();
  await bus.boot();

  const registry = new SkillRegistry({ eventBus: bus });
  await registry.boot();
  await registry.register(sampleSkill);

  const loader = new SkillLoader({ registry, eventBus: bus });
  await loader.boot();

  const store = new ArtifactStore({ eventBus: bus });
  await store.boot();

  const executor = new Executor({
    skillLoader: loader,
    artifactStore: store,
    eventBus: bus,
    maxWorkers: 2,
  });
  await executor.boot();

  const token: ICancellationToken = {
    isCancellationRequested: false,
    onCancelled: () => {},
  };

  const task: TaskContext = {
    taskId: 'task-100',
    nodeId: 'node-100',
    planId: 'plan-100',
    lease: {
      leaseId: 'lease-100',
      subject: 'unit-tester',
      capabilities: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      revoked: false,
    },
    cancellationToken: token,
  };

  const result = await executor.execute(task);
  assert.strictEqual(result.taskId, 'task-100');
  assert.strictEqual(result.outputArtifacts.length, 1);
  assert.strictEqual(typeof result.outputArtifacts[0].hash, 'string');

  const pool = executor.getPoolStatus();
  assert.strictEqual(pool.totalCapacity, 2);
  assert.strictEqual(pool.activeWorkers, 0);

  await executor.shutdown();
  await store.shutdown();
  await loader.shutdown();
  await registry.shutdown();
  await bus.shutdown();
});
