import { test } from 'node:test';
import assert from 'node:assert';
import * as path from 'node:path';
import { Executor } from './executor.js';
import { SkillRegistry, SkillLoader } from '@agy/registry';
import { ArtifactStore } from '@agy/artifact';
import { PolicyEngine } from '@agy/policy';
import { RuntimeState } from '@agy/runtime-state';
import { EventBus } from '@agy/event-bus';
import { ICancellationToken, SkillManifest, TaskContext, asUUID, asSemVer } from '@agy/shared';

const fixturesDir = path.resolve(__dirname, '..', 'fixtures');

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

test('Executor enforces policy lease coverage of required capabilities (SRC-5, SRC-6)', async () => {
  const state = new RuntimeState();
  await state.boot();
  const policy = new PolicyEngine({ runtimeState: state });
  await policy.boot();
  policy.registerPolicy({
    name: 'TestAllow',
    priority: 100,
    evaluate: (req) => ({ ...req, decision: 'allow', reason: 'test permit', policyVersion: '1.0.0' }),
  });

  const permSkill: SkillManifest = {
    ...sampleSkill,
    id: 'perm-skill',
    permissions: [{ name: 'fs:read', scope: '/project' }],
  };

  const registry = new SkillRegistry();
  await registry.boot();
  await registry.register(permSkill);

  const loader = new SkillLoader({ registry });
  await loader.boot();

  const executor = new Executor({ skillLoader: loader, policyEngine: policy });
  await executor.boot();

  const baseTask = (leaseId: string): TaskContext => ({
    taskId: asUUID('task-perm'),
    nodeId: asUUID('node-perm'),
    planId: asUUID('plan-perm'),
    lease: {
      leaseId: asUUID(leaseId),
      subject: 'perm-skill',
      capabilities: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      revoked: false,
    },
    cancellationToken: { isCancellationRequested: false, onCancelled: () => {} },
  });

  // Lease that does NOT cover the required /project scope -> must be denied.
  const deniedLease = await policy.issueLease('perm-skill', [{ name: 'fs:read', scope: '/elsewhere' }], 60000);
  await assert.rejects(
    async () => executor.execute(baseTask(deniedLease.leaseId)),
    (err: any) => err.code === 'LEASE_VALIDATION_FAILED'
  );

  // Lease that DOES cover the required scope -> must succeed.
  const grantedLease = await policy.issueLease('perm-skill', [{ name: 'fs:read', scope: '/project' }], 60000);
  const result = await executor.execute(baseTask(grantedLease.leaseId));
  assert.strictEqual(result.taskId, asUUID('task-perm'));

  await executor.shutdown();
  await loader.shutdown();
  await registry.shutdown();
  await policy.shutdown();
  await state.shutdown();
});

test('Executor runs a module-backed skill in an isolated worker and returns real output (SRC-1, SRC-2, SRC-3)', async () => {
  const registry = new SkillRegistry();
  await registry.boot();
  const echoSkill: SkillManifest = {
    ...sampleSkill,
    id: 'worker-echo-skill',
    modulePath: path.join(fixturesDir, 'echo.mjs'),
  };
  await registry.register(echoSkill);

  const loader = new SkillLoader({ registry });
  await loader.boot();
  const store = new ArtifactStore();
  await store.boot();
  const executor = new Executor({ skillLoader: loader, artifactStore: store });
  await executor.boot();

  const task: TaskContext = {
    taskId: asUUID('task-worker-1'),
    nodeId: asUUID('node-worker-1'),
    planId: asUUID('plan-worker-1'),
    lease: {
      leaseId: asUUID('lease-worker-1'),
      subject: 'worker-echo-skill',
      capabilities: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      revoked: false,
    },
    cancellationToken: { isCancellationRequested: false, onCancelled: () => {} },
  };

  const result = await executor.execute(task, { maxDurationMs: 5000 });
  assert.strictEqual(result.taskId, asUUID('task-worker-1'));
  assert.strictEqual(result.outputArtifacts.length, 1);
  // The stored artifact carries the REAL computed value from the worker module
  // (sum 0..999 = 499500), which the old hardcoded stub could never produce.
  const content = await store.get(result.outputArtifacts[0].hash);
  const payload = JSON.parse(content!.toString('utf-8'));
  assert.strictEqual(payload.computed, 499500);
  assert.strictEqual(payload.source, 'worker');

  await executor.shutdown();
  await loader.shutdown();
  await store.shutdown();
  await registry.shutdown();
});

test('Executor enforces memory limits on worker execution (SRC-4)', async () => {
  const registry = new SkillRegistry();
  await registry.boot();
  const hogSkill: SkillManifest = {
    ...sampleSkill,
    id: 'memory-hog-skill',
    modulePath: path.join(fixturesDir, 'alloc.mjs'),
  };
  await registry.register(hogSkill);

  const loader = new SkillLoader({ registry });
  await loader.boot();
  const executor = new Executor({ skillLoader: loader });
  await executor.boot();

  const task: TaskContext = {
    taskId: asUUID('task-mem'),
    nodeId: asUUID('node-mem'),
    planId: asUUID('plan-mem'),
    lease: {
      leaseId: asUUID('lease-mem'),
      subject: 'memory-hog-skill',
      capabilities: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      revoked: false,
    },
    cancellationToken: { isCancellationRequested: false, onCancelled: () => {} },
  };

  // 32MB limit; the fixture allocates ~128MB and must be killed.
  await assert.rejects(
    async () => executor.execute(task, { maxDurationMs: 10000, maxMemoryMb: 32 }),
    (err: any) => err.code === 'EXECUTION_FAILED' || err.code === 'EXECUTION_TIMEOUT'
  );

  // Worker must be terminated -> slot recovered.
  assert.strictEqual(executor.getPoolStatus().activeWorkers, 0);

  await executor.shutdown();
  await loader.shutdown();
  await registry.shutdown();
});

test('Executor hard-terminates a hanging worker on timeout (SRC-1)', async () => {
  const registry = new SkillRegistry();
  await registry.boot();
  const hangSkill: SkillManifest = {
    ...sampleSkill,
    id: 'hanging-worker-skill',
    modulePath: path.join(fixturesDir, 'hang.mjs'),
  };
  await registry.register(hangSkill);

  const loader = new SkillLoader({ registry });
  await loader.boot();
  const executor = new Executor({ skillLoader: loader });
  await executor.boot();

  const task: TaskContext = {
    taskId: asUUID('task-hang-w'),
    nodeId: asUUID('node-hang-w'),
    planId: asUUID('plan-hang-w'),
    lease: {
      leaseId: asUUID('lease-hang-w'),
      subject: 'hanging-worker-skill',
      capabilities: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      revoked: false,
    },
    cancellationToken: { isCancellationRequested: false, onCancelled: () => {} },
  };

  await assert.rejects(
    async () => executor.execute(task, { maxDurationMs: 300 }),
    (err: any) => err.code === 'EXECUTION_TIMEOUT'
  );
  assert.strictEqual(executor.getPoolStatus().activeWorkers, 0);

  await executor.shutdown();
  await loader.shutdown();
  await registry.shutdown();
});
