import { test } from 'node:test';
import assert from 'node:assert';
import { Scheduler } from './scheduler.js';
import { ExecutionPlan } from '@agy/shared';

test('Scheduler submits plan and dispatches ready nodes in topological order', async () => {
  const scheduler = new Scheduler();
  await scheduler.boot();

  const executedOrder: string[] = [];
  scheduler.registerDispatcher(async (_task, node) => {
    executedOrder.push(node.skillRef.id);
  });

  const plan: ExecutionPlan = {
    planId: 'test-plan-1',
    createdAt: Date.now(),
    status: 'pending',
    nodes: [
      {
        nodeId: 'node-1',
        skillRef: { id: 'step-1', version: '1.0.0', registryRef: 'r', lifecycleState: 'loaded' },
        inputs: [],
        limits: {},
        state: 'ready',
      },
      {
        nodeId: 'node-2',
        skillRef: { id: 'step-2', version: '1.0.0', registryRef: 'r', lifecycleState: 'loaded' },
        inputs: [],
        limits: {},
        state: 'ready',
      },
    ],
    edges: [
      { fromNodeId: 'node-1', toNodeId: 'node-2', kind: 'ordering' }, // node-2 depends on node-1
    ],
  };

  await scheduler.submit(plan);
  assert.strictEqual(scheduler.getPlanStatus('test-plan-1'), 'running');

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
  assert.strictEqual(scheduler.getPlanStatus('test-plan-1'), 'completed');

  await scheduler.shutdown();
});

test('Scheduler cancels active plan and notifies cancellation tokens', async () => {
  const scheduler = new Scheduler();
  await scheduler.boot();

  let wasCancelled = false;
  scheduler.registerDispatcher(async (task) => {
    task.cancellationToken.onCancelled(() => {
      wasCancelled = true;
    });
  });

  const plan: ExecutionPlan = {
    planId: 'plan-cancel',
    createdAt: Date.now(),
    status: 'pending',
    nodes: [
      {
        nodeId: 'node-c',
        skillRef: { id: 'long-task', version: '1.0.0', registryRef: 'r', lifecycleState: 'loaded' },
        inputs: [],
        limits: {},
        state: 'ready',
      },
    ],
    edges: [],
  };

  await scheduler.submit(plan);
  await scheduler.tick();

  // Cancel plan
  const cancelled = await scheduler.cancel('plan-cancel');
  assert.strictEqual(cancelled, true);
  assert.strictEqual(wasCancelled, true);
  assert.strictEqual(scheduler.getPlanStatus('plan-cancel'), 'cancelled');

  await scheduler.shutdown();
});
