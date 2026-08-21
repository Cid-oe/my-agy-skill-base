"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const executor_js_1 = require("./executor.js");
const registry_1 = require("@agy/registry");
const artifact_1 = require("@agy/artifact");
const event_bus_1 = require("@agy/event-bus");
const sampleSkill = {
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
(0, node_test_1.test)('Executor executes tasks, bounds worker concurrency, and produces artifacts', async () => {
    const bus = new event_bus_1.EventBus();
    await bus.boot();
    const registry = new registry_1.SkillRegistry({ eventBus: bus });
    await registry.boot();
    await registry.register(sampleSkill);
    const loader = new registry_1.SkillLoader({ registry, eventBus: bus });
    await loader.boot();
    const store = new artifact_1.ArtifactStore({ eventBus: bus });
    await store.boot();
    const executor = new executor_js_1.Executor({
        skillLoader: loader,
        artifactStore: store,
        eventBus: bus,
        maxWorkers: 2,
    });
    await executor.boot();
    const token = {
        isCancellationRequested: false,
        onCancelled: () => { },
    };
    const task = {
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
    node_assert_1.default.strictEqual(result.taskId, 'task-100');
    node_assert_1.default.strictEqual(result.outputArtifacts.length, 1);
    node_assert_1.default.strictEqual(typeof result.outputArtifacts[0].hash, 'string');
    const pool = executor.getPoolStatus();
    node_assert_1.default.strictEqual(pool.totalCapacity, 2);
    node_assert_1.default.strictEqual(pool.activeWorkers, 0);
    await executor.shutdown();
    await store.shutdown();
    await loader.shutdown();
    await registry.shutdown();
    await bus.shutdown();
});
//# sourceMappingURL=executor.test.js.map