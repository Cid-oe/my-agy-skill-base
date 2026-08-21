"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const scheduler_js_1 = require("./scheduler.js");
(0, node_test_1.test)('Scheduler submits plan and dispatches ready nodes in topological order', async () => {
    const scheduler = new scheduler_js_1.Scheduler();
    await scheduler.boot();
    const executedOrder = [];
    scheduler.registerDispatcher(async (_task, node) => {
        executedOrder.push(node.skillRef.id);
    });
    const plan = {
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
    node_assert_1.default.strictEqual(scheduler.getPlanStatus('test-plan-1'), 'running');
    // Tick 1: only node-1 should be ready
    const count1 = await scheduler.tick();
    node_assert_1.default.strictEqual(count1, 1);
    node_assert_1.default.deepStrictEqual(executedOrder, ['step-1']);
    // Tick 2: node-2 should now be ready after node-1 completion
    const count2 = await scheduler.tick();
    node_assert_1.default.strictEqual(count2, 1);
    node_assert_1.default.deepStrictEqual(executedOrder, ['step-1', 'step-2']);
    // Tick 3: plan completes
    await scheduler.tick();
    node_assert_1.default.strictEqual(scheduler.getPlanStatus('test-plan-1'), 'completed');
    await scheduler.shutdown();
});
(0, node_test_1.test)('Scheduler cancels active plan and notifies cancellation tokens', async () => {
    const scheduler = new scheduler_js_1.Scheduler();
    await scheduler.boot();
    let wasCancelled = false;
    scheduler.registerDispatcher(async (task) => {
        task.cancellationToken.onCancelled(() => {
            wasCancelled = true;
        });
    });
    const plan = {
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
    node_assert_1.default.strictEqual(cancelled, true);
    node_assert_1.default.strictEqual(wasCancelled, true);
    node_assert_1.default.strictEqual(scheduler.getPlanStatus('plan-cancel'), 'cancelled');
    await scheduler.shutdown();
});
//# sourceMappingURL=scheduler.test.js.map