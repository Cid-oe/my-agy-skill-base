import { test } from 'node:test';
import assert from 'node:assert';
import { Executor } from './executor.js';
import { SkillRegistry, SkillLoader } from '@agy/registry';
import { ArtifactStore } from '@agy/artifact';
import { EventBus } from '@agy/event-bus';
import { ICancellationToken, SkillManifest, TaskContext, asUUID, asSemVer } from '@agy/shared';

const sampleSkill: SkillManifest = {
  id: 'unit-tester',
  name: 'Unit Tester',
  version: asSemVer('1.0.0'),
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
    taskId: asUUID('task-100'),
    nodeId: asUUID('node-100'),
    planId: asUUID('plan-100'),
    lease: {
      leaseId: asUUID('lease-100'),
      subject: 'unit-tester',
      capabilities: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      revoked: false,
    },
    cancellationToken: token,
  };

  const result = await executor.execute(task);
  assert.strictEqual(result.taskId, asUUID('task-100'));
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

test('Executor stamps exact skill version on produced artifacts for provenance', async () => {
  const customSkill: SkillManifest = {
    ...sampleSkill,
    id: 'versioned-skill',
    version: asSemVer('3.7.2'),
  };

  const registry = new SkillRegistry();
  await registry.boot();
  await registry.register(customSkill);

  const loader = new SkillLoader({ registry });
  await loader.boot();

  const store = new ArtifactStore();
  await store.boot();

  const executor = new Executor({ skillLoader: loader, artifactStore: store });
  await executor.boot();

  const task: TaskContext = {
    taskId: asUUID('task-prov'),
    nodeId: asUUID('node-prov'),
    planId: asUUID('plan-prov'),
    lease: {
      leaseId: asUUID('lease-prov'),
      subject: 'versioned-skill',
      capabilities: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      revoked: false,
    },
    cancellationToken: { isCancellationRequested: false, onCancelled: () => {} },
  };

  const result = await executor.execute(task);
  assert.strictEqual(result.outputArtifacts.length, 1);
  assert.strictEqual(result.outputArtifacts[0].createdBy.version, '3.7.2');

  await executor.shutdown();
  await store.shutdown();
  await loader.shutdown();
  await registry.shutdown();
});

test('Executor enforces timeouts and frees worker slot immediately', async () => {
  const hangingSkill: SkillManifest = {
    ...sampleSkill,
    id: 'hanging-skill',
  };

  const registry = new SkillRegistry();
  await registry.boot();
  await registry.register(hangingSkill);

  const loader = new SkillLoader({ registry });
  await loader.boot();

  // Override execute on loader to simulate hanging task
  const loaded = await loader.load('hanging-skill');
  loaded.execute = async () => {
    await new Promise((r) => setTimeout(r, 200));
  };

  const executor = new Executor({ skillLoader: loader, maxWorkers: 1 });
  await executor.boot();

  const task: TaskContext = {
    taskId: asUUID('task-hang'),
    nodeId: asUUID('node-hang'),
    planId: asUUID('plan-hang'),
    lease: {
      leaseId: asUUID('lease-hang'),
      subject: 'hanging-skill',
      capabilities: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      revoked: false,
    },
    cancellationToken: { isCancellationRequested: false, onCancelled: () => {} },
  };

  await assert.rejects(
    async () => {
      await executor.execute(task, { maxDurationMs: 20 });
    },
    (err: any) => {
      return err.code === 'EXECUTION_TIMEOUT';
    }
  );

  // Worker slot should be freed immediately
  assert.strictEqual(executor.getPoolStatus().activeWorkers, 0);

  await executor.shutdown();
  await loader.shutdown();
  await registry.shutdown();
});
