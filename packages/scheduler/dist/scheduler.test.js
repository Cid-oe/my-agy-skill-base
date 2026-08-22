"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const scheduler_js_1 = require("./scheduler.js");
const shared_1 = require("@agy/shared");
(0, node_test_1.test)('Scheduler submits plan and dispatches ready nodes in topological order', async () => {
    const scheduler = new scheduler_js_1.Scheduler();
    await scheduler.boot();
    const executedOrder = [];
    scheduler.registerDispatcher(async (_task, node) => {
        executedOrder.push(node.skillRef.id);
    });
    const plan = {
        planId: (0, shared_1.asUUID)('test-plan-1'),
        createdAt: Date.now(),
        status: 'pending',
        nodes: [
            {
                nodeId: (0, shared_1.asUUID)('node-1'),
                skillRef: { id: 'step-1', version: (0, shared_1.asSemVer)('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' },
                inputs: [],
                limits: {},
                state: 'ready',
            },
            {
                nodeId: (0, shared_1.asUUID)('node-2'),
                skillRef: { id: 'step-2', version: (0, shared_1.asSemVer)('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' },
                inputs: [],
                limits: {},
                state: 'ready',
            },
        ],
        edges: [
            { fromNodeId: (0, shared_1.asUUID)('node-1'), toNodeId: (0, shared_1.asUUID)('node-2'), kind: 'ordering' }, // node-2 depends on node-1
        ],
    };
    await scheduler.submit(plan);
    node_assert_1.default.strictEqual(scheduler.getPlanStatus((0, shared_1.asUUID)('test-plan-1')), 'running');
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
    node_assert_1.default.strictEqual(scheduler.getPlanStatus((0, shared_1.asUUID)('test-plan-1')), 'completed');
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
        await new Promise((r) => setTimeout(r, 50));
    });
    const plan = {
        planId: (0, shared_1.asUUID)('plan-cancel'),
        createdAt: Date.now(),
        status: 'pending',
        nodes: [
            {
                nodeId: (0, shared_1.asUUID)('node-c'),
                skillRef: { id: 'long-task', version: (0, shared_1.asSemVer)('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' },
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
    const cancelled = await scheduler.cancel((0, shared_1.asUUID)('plan-cancel'));
    node_assert_1.default.strictEqual(cancelled, true);
    await tickPromise;
    node_assert_1.default.strictEqual(wasCancelled, true);
    node_assert_1.default.strictEqual(scheduler.getPlanStatus((0, shared_1.asUUID)('plan-cancel')), 'cancelled');
    await scheduler.shutdown();
});
(0, node_test_1.test)('Scheduler transitions plan to error state and cancels other nodes on task failure', async () => {
    const scheduler = new scheduler_js_1.Scheduler();
    await scheduler.boot();
    let cancelledNodes = [];
    scheduler.registerDispatcher(async (task, node) => {
        task.cancellationToken.onCancelled(() => {
            cancelledNodes.push(node.nodeId);
        });
        if (node.nodeId === (0, shared_1.asUUID)('node-fail')) {
            throw new Error('Task execution failed');
        }
        // Simulate long running for node-ok
        await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const plan = {
        planId: (0, shared_1.asUUID)('plan-fail-propagation'),
        createdAt: Date.now(),
        status: 'pending',
        nodes: [
            {
                nodeId: (0, shared_1.asUUID)('node-fail'),
                skillRef: { id: 'fail-task', version: (0, shared_1.asSemVer)('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' },
                inputs: [],
                limits: {},
                state: 'ready',
            },
            {
                nodeId: (0, shared_1.asUUID)('node-ok'),
                skillRef: { id: 'ok-task', version: (0, shared_1.asSemVer)('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' },
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
    node_assert_1.default.strictEqual(scheduler.getPlanStatus((0, shared_1.asUUID)('plan-fail-propagation')), 'failed');
    node_assert_1.default.strictEqual(cancelledNodes.includes((0, shared_1.asUUID)('node-ok')), true);
    await scheduler.shutdown();
});
(0, node_test_1.test)('Scheduler dispatches independent DAG branches concurrently (Diamond DAG)', async () => {
    const scheduler = new scheduler_js_1.Scheduler();
    await scheduler.boot();
    const parallelRuns = [];
    scheduler.registerDispatcher(async (_task, node) => {
        parallelRuns.push(node.skillRef.id);
    });
    const plan = {
        planId: (0, shared_1.asUUID)('plan-diamond'),
        createdAt: Date.now(),
        status: 'pending',
        nodes: [
            { nodeId: (0, shared_1.asUUID)('node-A'), skillRef: { id: 'skill-A', version: (0, shared_1.asSemVer)('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' }, inputs: [], limits: {}, state: 'ready' },
            { nodeId: (0, shared_1.asUUID)('node-B'), skillRef: { id: 'skill-B', version: (0, shared_1.asSemVer)('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' }, inputs: [], limits: {}, state: 'ready' },
            { nodeId: (0, shared_1.asUUID)('node-C'), skillRef: { id: 'skill-C', version: (0, shared_1.asSemVer)('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' }, inputs: [], limits: {}, state: 'ready' },
            { nodeId: (0, shared_1.asUUID)('node-D'), skillRef: { id: 'skill-D', version: (0, shared_1.asSemVer)('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' }, inputs: [], limits: {}, state: 'ready' },
        ],
        edges: [
            { fromNodeId: (0, shared_1.asUUID)('node-A'), toNodeId: (0, shared_1.asUUID)('node-B'), kind: 'ordering' },
            { fromNodeId: (0, shared_1.asUUID)('node-A'), toNodeId: (0, shared_1.asUUID)('node-C'), kind: 'ordering' },
            { fromNodeId: (0, shared_1.asUUID)('node-B'), toNodeId: (0, shared_1.asUUID)('node-D'), kind: 'ordering' },
            { fromNodeId: (0, shared_1.asUUID)('node-C'), toNodeId: (0, shared_1.asUUID)('node-D'), kind: 'ordering' },
        ],
    };
    await scheduler.submit(plan);
    // Tick 1: node-A executes
    await scheduler.tick();
    node_assert_1.default.deepStrictEqual(parallelRuns, ['skill-A']);
    // Tick 2: node-B and node-C execute concurrently in same tick
    const count2 = await scheduler.tick();
    node_assert_1.default.strictEqual(count2, 2);
    node_assert_1.default.strictEqual(parallelRuns.includes('skill-B'), true);
    node_assert_1.default.strictEqual(parallelRuns.includes('skill-C'), true);
    // Tick 3: node-D executes
    await scheduler.tick();
    node_assert_1.default.strictEqual(parallelRuns[3], 'skill-D');
    await scheduler.shutdown();
});
(0, node_test_1.test)('Scheduler elevates task dispatch priority via enqueue aging', async () => {
    const scheduler = new scheduler_js_1.Scheduler({ agingFactorMs: 1 }); // 1ms aging rate
    await scheduler.boot();
    const dispatched = [];
    scheduler.registerDispatcher(async (_task, node) => {
        dispatched.push(node.skillRef.id);
    });
    const plan = {
        planId: (0, shared_1.asUUID)('plan-aging'),
        createdAt: Date.now() - 5000, // Aged plan (old)
        status: 'pending',
        nodes: [
            { nodeId: (0, shared_1.asUUID)('node-old-low'), skillRef: { id: 'old-low-priority', version: (0, shared_1.asSemVer)('1.0.0'), registryRef: 'r', lifecycleState: 'loaded' }, inputs: [], limits: {}, state: 'ready' },
        ],
        edges: [],
    };
    await scheduler.submit(plan);
    await scheduler.tick();
    node_assert_1.default.strictEqual(dispatched.length, 1);
    node_assert_1.default.strictEqual(dispatched[0], 'old-low-priority');
    await scheduler.shutdown();
});
//# sourceMappingURL=scheduler.test.js.map