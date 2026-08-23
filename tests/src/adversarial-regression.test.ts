import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { EventBus, IEventBus } from '@agy/event-bus';
import { ArtifactStore } from '@agy/artifact';
import { RuntimeState, computeCrc } from '@agy/runtime-state';
import { PolicyEngine } from '@agy/policy';
import { SkillRegistry, SkillLoader } from '@agy/registry';
import { Executor } from '@agy/executor';
import { Scheduler } from '@agy/scheduler';
import { SkillResolver } from '@agy/resolver';
import { Kernel } from '@agy/kernel';
import { asHash, asSemVer, asUUID, ExecutionPlan, PlanNode, SkillManifest, TaskContext } from '@agy/shared';

function manifest(id: string, overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    id, name: id, version: asSemVer('1.0.0'), description: id, priority: 'medium',
    requires: [], optional: [], consumes: [], produces: [`${id}-output`], exclusiveWith: [],
    confidenceThreshold: 0.8, triggerPredicates: [], permissions: [], capabilities: [], entryPoint: 'skill.mjs',
    ...overrides,
  };
}

function node(id: string, overrides: Partial<PlanNode> = {}): PlanNode {
  return {
    nodeId: asUUID(id), skillRef: { id, version: asSemVer('1.0.0'), registryRef: '', lifecycleState: 'loaded' },
    inputs: [], limits: {}, state: 'ready', ...overrides,
  };
}

function plan(id: string, nodes: PlanNode[], edges: ExecutionPlan['edges'] = []): ExecutionPlan {
  return { planId: asUUID(id), nodes, edges, createdAt: Date.now(), status: 'pending' };
}

function task(subject: string, leaseOverrides: Partial<TaskContext['lease']> = {}): TaskContext {
  return {
    taskId: asUUID(`task-${subject}`), nodeId: asUUID(`node-${subject}`), planId: asUUID(`plan-${subject}`),
    lease: {
      leaseId: asUUID(`lease-${subject}`), subject, capabilities: [], issuedAt: Date.now(), expiresAt: Date.now() + 60000,
      revoked: false, ...leaseOverrides,
    },
    cancellationToken: { isCancellationRequested: false, onCancelled: () => undefined },
  };
}

test('Adversarial: lease issuance is fail-closed and validates constraints', async () => {
  const state = new RuntimeState(); await state.boot();
  const policy = new PolicyEngine({ runtimeState: state }); await policy.boot();
  await assert.rejects(() => policy.issueLease('untrusted', [{ name: 'fs:write', scope: '/' }]), (error: any) => error.code === 'LEASE_DENIED');
  policy.registerPolicy({ name: 'allow', priority: 1, evaluate: (request) => ({ ...request, decision: 'allow', reason: 'test', policyVersion: '1' }) });
  const lease = await policy.issueLease('trusted', [{ name: 'network', scope: 'api', constraints: { method: 'GET' } }]);
  assert.equal(await policy.validateLease(lease.leaseId, { name: 'network', scope: 'api', constraints: { method: 'DELETE' } }), false);
  await state.shutdown();
});

test('Adversarial: executor rejects invalid leases even for permissionless skills', async () => {
  const registry = new SkillRegistry(); await registry.boot(); await registry.register(manifest('permissionless'));
  const loader = new SkillLoader({ registry }); await loader.boot();
  const state = new RuntimeState(); await state.boot(); const policy = new PolicyEngine({ runtimeState: state }); await policy.boot();
  const executor = new Executor({ skillLoader: loader, policyEngine: policy }); await executor.boot();
  await assert.rejects(() => executor.execute(task('permissionless', { revoked: true })), (error: any) => error.code === 'LEASE_VALIDATION_FAILED');
  await executor.shutdown(); await loader.shutdown(); await registry.shutdown(); await policy.shutdown(); await state.shutdown();
});

test('Adversarial: durable artifact streams reject corruption and unsafe hashes', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-adversarial-cas-'));
  try {
    const store = new ArtifactStore({ persistenceDir: directory }); await store.boot();
    const envelope = await store.put('original');
    fs.writeFileSync(path.join(directory, 'cas', envelope.hash.slice(0, 2), envelope.hash), 'tampered');
    await assert.rejects(() => store.getStream(envelope.hash), (error: any) => error.code === 'ARTIFACT_CORRUPTED');
    await assert.rejects(() => store.getStream(asHash('../secret')), (error: any) => error.code === 'ARTIFACT_HASH_INVALID');
    await store.shutdown();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('Adversarial: runtime state preserves commit semantics when event delivery fails', async () => {
  const failedBus = { publish: async () => { throw new Error('event transport down'); } } as unknown as IEventBus;
  const state = new RuntimeState({ eventBus: failedBus }); await state.boot();
  const result = await state.trackPlan(asUUID('event-failure-plan'));
  assert.equal(result, undefined);
  assert.equal(state.getSnapshot().activePlans.includes(asUUID('event-failure-plan')), true);
  assert.equal(state.getSnapshot().version, 1);
  await state.shutdown();
});

test('Adversarial: WAL record recovery is atomic', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-adversarial-wal-'));
  try {
    fs.mkdirSync(path.join(directory, 'wal'), { recursive: true });
    const commands = [{ type: 'TRACK_PLAN', payload: { planId: asUUID('atomic-recovery') } }, { type: 'UNKNOWN', payload: {} }];
    fs.writeFileSync(path.join(directory, 'wal', 'current.wal'), JSON.stringify({ seq: 1, crc: computeCrc(commands), timestamp: Date.now(), commands }) + '\n');
    const state = new RuntimeState({ persistenceDir: directory }); await state.boot();
    assert.equal(state.getSnapshot().activePlans.length, 0);
    assert.equal(state.getSnapshot().version, 0);
    await state.shutdown();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('Adversarial: EventBus preserves per-key order and settles forced shutdown', async () => {
  const bus = new EventBus({ shutdownDrainMs: 5 }); await bus.boot();
  const order: string[] = [];
  bus.subscribe('first', async () => { await new Promise((resolve) => setTimeout(resolve, 20)); order.push('first'); });
  bus.subscribe('second', () => { order.push('second'); });
  await Promise.all([bus.publish('first', { id: asUUID('first'), topic: 'first', key: 'same', payload: {}, timestamp: 0 }), bus.publish('second', { id: asUUID('second'), topic: 'second', key: 'same', payload: {}, timestamp: 0 })]);
  assert.deepEqual(order, ['first', 'second']);

  const hanging = new EventBus({ shutdownDrainMs: 5 }); await hanging.boot();
  hanging.subscribe('hang', async () => new Promise(() => undefined));
  const published = hanging.publish('hang', { id: asUUID('hang'), topic: 'hang', key: 'k', payload: {}, timestamp: 0 });
  await hanging.shutdown();
  assert.equal(await Promise.race([published.then(() => 'settled'), new Promise((resolve) => setTimeout(() => resolve('hung'), 30))]), 'settled');
});

test('Adversarial: scheduler rejects cycles and preserves cancellation terminal state', async () => {
  const scheduler = new Scheduler(); await scheduler.boot(); scheduler.registerDispatcher(async () => new Promise((_, reject) => setTimeout(() => reject(new Error('cancelled')), 5)));
  const a = node('cycle-a'); const b = node('cycle-b');
  await assert.rejects(() => scheduler.submit(plan('cycle-plan', [a, b], [
    { fromNodeId: a.nodeId, toNodeId: b.nodeId, kind: 'ordering' },
    { fromNodeId: b.nodeId, toNodeId: a.nodeId, kind: 'ordering' },
  ])), (error: any) => error.code === 'PLAN_CYCLE');
  const live = plan('cancel-plan', [node('cancel-node')]); await scheduler.submit(live);
  const ticking = scheduler.tick(); await new Promise((resolve) => setTimeout(resolve, 1)); await scheduler.cancel(live.planId); await ticking;
  assert.equal(scheduler.getPlanStatus(live.planId), 'cancelled'); await scheduler.shutdown();
});

test('Adversarial: resolver rejects impossible inputs and honors existing artifacts/version ranges', async () => {
  const registry = new SkillRegistry(); await registry.boot();
  await registry.register(manifest('missing-consumer', { consumes: ['NeverProduced'], produces: ['Final'] }));
  const resolver = new SkillResolver(); await resolver.boot();
  const missing = await resolver.resolve({ id: 'missing', kind: 'subtask', description: '', requiredArtifacts: ['Final'] }, registry);
  assert.notEqual(missing.status, 'resolved');

  await registry.register(manifest('available-consumer', { consumes: ['AlreadyThere'], produces: ['Final2'] }));
  const available = await resolver.resolve({ id: 'available', kind: 'subtask', description: '', requiredArtifacts: ['Final2'] }, registry, { availableArtifacts: ['AlreadyThere'] });
  assert.equal(available.plan?.nodes.length, 1);

  await registry.register(manifest('dep-version', { version: asSemVer('1.0.0') }));
  await registry.register(manifest('version-consumer', { requires: ['dep-version'], requiresSkillVersion: 'dep-version@>=2.0.0', produces: ['Final3'] }));
  const incompatible = await resolver.resolve({ id: 'version', kind: 'subtask', description: '', requiredArtifacts: ['Final3'] }, registry);
  assert.notEqual(incompatible.status, 'resolved'); await resolver.shutdown(); await registry.shutdown();
});

test('Adversarial: registry activation and returned manifests are immutable', async () => {
  const registry = new SkillRegistry(); await registry.boot();
  await registry.register(manifest('versioned-skill', { version: asSemVer('2.0.0') }));
  await registry.register(manifest('versioned-skill', { version: asSemVer('1.0.0') }));
  assert.equal(registry.getActiveVersion('versioned-skill')?.version, asSemVer('2.0.0'));
  const returned = registry.getManifest('versioned-skill')!; returned.name = 'tampered';
  assert.equal(registry.getManifest('versioned-skill')?.name, 'versioned-skill'); await registry.shutdown();
});

test('Adversarial: kernel handles are live and health reflects degraded subsystems', async () => {
  const kernel = new Kernel();
  const bad = { id: asUUID('bad-subsystem'), name: 'bad-subsystem', boot: async () => undefined, shutdown: async () => undefined,
    start: async () => undefined, stop: async () => undefined, health: () => ({ status: 'unhealthy' as const, uptimeMs: 0 }),
    getHealth: async () => ({ status: 'unhealthy' as const, uptimeMs: 0 }) };
  kernel.registerSubsystem(bad); const handle = await kernel.boot();
  assert.equal((await handle.health()).kernel.status, 'degraded'); await handle.shutdown(); assert.equal(handle.state, 'shutdown');
});

test('Adversarial: durable putStream requires boot and preserves holder-scoped pins', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-adversarial-pin-'));
  try {
    const store = new ArtifactStore({ persistenceDir: directory });
    await assert.rejects(() => store.putStream(Readable.from(['x'])), (error: any) => error.code === 'STORE_NOT_READY');
    await store.boot(); const env = await store.put('x'); await store.decrementRefCount(env.hash);
    await store.pin(env.hash, 'holder-a'); await store.pin(env.hash, 'holder-b'); await store.unpin(env.hash, 'holder-a');
    assert.equal((await store.gc()).deletedCount, 0); await store.unpin(env.hash, 'holder-b'); assert.equal((await store.gc()).deletedCount, 1); await store.shutdown();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

