import { test } from 'node:test';
import assert from 'node:assert';
import { Scheduler } from './scheduler.js';
import { asUUID, asSemVer, ExecutionPlan, TaskContext, PlanNode } from '@agy/shared';

test('Scheduler submits plan and dispatches ready nodes in topological order', async () => {
  const scheduler = new Scheduler();
  await scheduler.boot();

  const executedOrder: string[] = [];
  scheduler.registerDispatcher(async (_task: TaskContext, node: PlanNode) => {
    executedOrder.push(node.skillRef.id);
  });

  const plan: ExecutionPlan = {
    planId: asUUID('test-plan-1'),
    createdAt: Date.now(),
    status: 'pending',
    nodes: [
      {
        nodeId: asUUID('node-1'),
        skillRef: { id: 'step-1', version: asSemVer('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' },
        inputs: [],
        limits: {},
        state: 'ready',
      },
      {
        nodeId: asUUID('node-2'),
        skillRef: { id: 'step-2', version: asSemVer('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' },
        inputs: [],
        limits: {},
        state: 'ready',
      },
    ],
    edges: [
      { fromNodeId: asUUID('node-1'), toNodeId: asUUID('node-2'), kind: 'ordering' }, // node-2 depends on node-1
    ],
  };

  await scheduler.submit(plan);
  assert.strictEqual(scheduler.getPlanStatus(asUUID('test-plan-1')), 'running');

  // Tick 1: only node-1 should be ready
  const count1 = await scheduler.tick();
  assert.strictEqual(count1, 1);
  assert.deepStrictEqual(executedOrder, ['step-1']);

  // Tick 2: node-2 should now be ready after node-1 completion
  const count2 = await scheduler.tick();
  assert.strictEqual(count2, 1);
  assert.deepStrictEqual(executedOrder, ['step-1', 'step-2']);

  // Tick 3: plan completes
  await scheduler.tick();
  assert.strictEqual(scheduler.getPlanStatus(asUUID('test-plan-1')), 'completed');

  await scheduler.shutdown();
});

test('Scheduler cancels active plan and notifies cancellation tokens', async () => {
  const scheduler = new Scheduler();
  await scheduler.boot();

  let wasCancelled = false;
  scheduler.registerDispatcher(async (task: TaskContext) => {
    task.cancellationToken.onCancelled(() => {
      wasCancelled = true;
    });
    await new Promise((r) => setTimeout(r, 50));
  });

  const plan: ExecutionPlan = {
    planId: asUUID('plan-cancel'),
    createdAt: Date.now(),
    status: 'pending',
    nodes: [
      {
        nodeId: asUUID('node-c'),
        skillRef: { id: 'long-task', version: asSemVer('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' },
        inputs: [],
        limits: {},
        state: 'ready',
      },
    ],
    edges: [],
  };

  await scheduler.submit(plan);
  const tickPromise = scheduler.tick();

  // Cancel plan while task is running
  const cancelled = await scheduler.cancel(asUUID('plan-cancel'));
  assert.strictEqual(cancelled, true);
  
  await tickPromise;
  assert.strictEqual(wasCancelled, true);
  assert.strictEqual(scheduler.getPlanStatus(asUUID('plan-cancel')), 'cancelled');

  await scheduler.shutdown();
});

test('Scheduler transitions plan to error state and cancels other nodes on task failure', async () => {
  const scheduler = new Scheduler();
  await scheduler.boot();

  let cancelledNodes: string[] = [];
  scheduler.registerDispatcher(async (task: TaskContext, node: PlanNode) => {
    task.cancellationToken.onCancelled(() => {
      cancelledNodes.push(node.nodeId);
    });

    if (node.nodeId === asUUID('node-fail')) {
      throw new Error('Task execution failed');
    }
    // Simulate long running for node-ok
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  const plan: ExecutionPlan = {
    planId: asUUID('plan-fail-propagation'),
    createdAt: Date.now(),
    status: 'pending',
    nodes: [
      {
        nodeId: asUUID('node-fail'),
        skillRef: { id: 'fail-task', version: asSemVer('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' },
        inputs: [],
        limits: {},
        state: 'ready',
      },
      {
        nodeId: asUUID('node-ok'),
        skillRef: { id: 'ok-task', version: asSemVer('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' },
        inputs: [],
        limits: {},
        state: 'ready',
      },
    ],
    edges: [],
  };

  await scheduler.submit(plan);
  
  // Tick will dispatch both. node-fail throws instantly, transitioning plan to 'failed' and triggering cancel.
  await scheduler.tick();

  assert.strictEqual(scheduler.getPlanStatus(asUUID('plan-fail-propagation')), 'failed');
  assert.strictEqual(cancelledNodes.includes(asUUID('node-ok')), true);

  await scheduler.shutdown();
});

test('Scheduler dispatches independent DAG branches concurrently (Diamond DAG)', async () => {
  const scheduler = new Scheduler();
  await scheduler.boot();

  const parallelRuns: string[] = [];
  scheduler.registerDispatcher(async (_task: TaskContext, node: PlanNode) => {
    parallelRuns.push(node.skillRef.id);
  });

  const plan: ExecutionPlan = {
    planId: asUUID('plan-diamond'),
    createdAt: Date.now(),
    status: 'pending',
    nodes: [
      { nodeId: asUUID('node-A'), skillRef: { id: 'skill-A', version: asSemVer('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' }, inputs: [], limits: {}, state: 'ready' },
      { nodeId: asUUID('node-B'), skillRef: { id: 'skill-B', version: asSemVer('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' }, inputs: [], limits: {}, state: 'ready' },
      { nodeId: asUUID('node-C'), skillRef: { id: 'skill-C', version: asSemVer('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' }, inputs: [], limits: {}, state: 'ready' },
      { nodeId: asUUID('node-D'), skillRef: { id: 'skill-D', version: asSemVer('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' }, inputs: [], limits: {}, state: 'ready' },
    ],
    edges: [
      { fromNodeId: asUUID('node-A'), toNodeId: asUUID('node-B'), kind: 'ordering' },
      { fromNodeId: asUUID('node-A'), toNodeId: asUUID('node-C'), kind: 'ordering' },
      { fromNodeId: asUUID('node-B'), toNodeId: asUUID('node-D'), kind: 'ordering' },
      { fromNodeId: asUUID('node-C'), toNodeId: asUUID('node-D'), kind: 'ordering' },
    ],
  };

  await scheduler.submit(plan);

  // Tick 1: node-A executes
  await scheduler.tick();
  assert.deepStrictEqual(parallelRuns, ['skill-A']);

  // Tick 2: node-B and node-C execute concurrently in same tick
  const count2 = await scheduler.tick();
  assert.strictEqual(count2, 2);
  assert.strictEqual(parallelRuns.includes('skill-B'), true);
  assert.strictEqual(parallelRuns.includes('skill-C'), true);

  // Tick 3: node-D executes
  await scheduler.tick();
  assert.strictEqual(parallelRuns[3], 'skill-D');

  await scheduler.shutdown();
});

test('Scheduler elevates task dispatch priority via enqueue aging', async () => {
  const scheduler = new Scheduler({ agingFactorMs: 1 }); // 1ms aging rate
  await scheduler.boot();

  const dispatched: string[] = [];
  scheduler.registerDispatcher(async (_task: TaskContext, node: PlanNode) => {
    dispatched.push(node.skillRef.id);
  });

  const plan: ExecutionPlan = {
    planId: asUUID('plan-aging'),
    createdAt: Date.now() - 5000, // Aged plan (old)
    status: 'pending',
    nodes: [
      { nodeId: asUUID('node-old-low'), skillRef: { id: 'old-low-priority', version: asSemVer('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' }, inputs: [], limits: {}, state: 'ready' },
    ],
    edges: [],
  };

  await scheduler.submit(plan);
  await scheduler.tick();

  assert.strictEqual(dispatched.length, 1);
  assert.strictEqual(dispatched[0], 'old-low-priority');

  await scheduler.shutdown();
});

