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
const shared_1 = require("@agy/shared");
const sampleSkill = {
    id: 'unit-tester',
    name: 'Unit Tester',
    version: (0, shared_1.asSemVer)('1.0.0'),
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
        taskId: (0, shared_1.asUUID)('task-100'),
        nodeId: (0, shared_1.asUUID)('node-100'),
        planId: (0, shared_1.asUUID)('plan-100'),
        lease: {
            leaseId: (0, shared_1.asUUID)('lease-100'),
            subject: 'unit-tester',
            capabilities: [],
            issuedAt: Date.now(),
            expiresAt: Date.now() + 60000,
            revoked: false,
        },
        cancellationToken: token,
    };
    const result = await executor.execute(task);
    node_assert_1.default.strictEqual(result.taskId, (0, shared_1.asUUID)('task-100'));
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
(0, node_test_1.test)('Executor stamps exact skill version on produced artifacts for provenance', async () => {
    const customSkill = {
        ...sampleSkill,
        id: 'versioned-skill',
        version: (0, shared_1.asSemVer)('3.7.2'),
    };
    const registry = new registry_1.SkillRegistry();
    await registry.boot();
    await registry.register(customSkill);
    const loader = new registry_1.SkillLoader({ registry });
    await loader.boot();
    const store = new artifact_1.ArtifactStore();
    await store.boot();
    const executor = new executor_js_1.Executor({ skillLoader: loader, artifactStore: store });
    await executor.boot();
    const task = {
        taskId: (0, shared_1.asUUID)('task-prov'),
        nodeId: (0, shared_1.asUUID)('node-prov'),
        planId: (0, shared_1.asUUID)('plan-prov'),
        lease: {
            leaseId: (0, shared_1.asUUID)('lease-prov'),
            subject: 'versioned-skill',
            capabilities: [],
            issuedAt: Date.now(),
            expiresAt: Date.now() + 60000,
            revoked: false,
        },
        cancellationToken: { isCancellationRequested: false, onCancelled: () => { } },
    };
    const result = await executor.execute(task);
    node_assert_1.default.strictEqual(result.outputArtifacts.length, 1);
    node_assert_1.default.strictEqual(result.outputArtifacts[0].createdBy.version, '3.7.2');
    await executor.shutdown();
    await store.shutdown();
    await loader.shutdown();
    await registry.shutdown();
});
(0, node_test_1.test)('Executor enforces timeouts and frees worker slot immediately', async () => {
    const hangingSkill = {
        ...sampleSkill,
        id: 'hanging-skill',
    };
    const registry = new registry_1.SkillRegistry();
    await registry.boot();
    await registry.register(hangingSkill);
    const loader = new registry_1.SkillLoader({ registry });
    await loader.boot();
    // Override execute on loader to simulate hanging task
    const loaded = await loader.load('hanging-skill');
    loaded.execute = async () => {
        await new Promise((r) => setTimeout(r, 200));
    };
    const executor = new executor_js_1.Executor({ skillLoader: loader, maxWorkers: 1 });
    await executor.boot();
    const task = {
        taskId: (0, shared_1.asUUID)('task-hang'),
        nodeId: (0, shared_1.asUUID)('node-hang'),
        planId: (0, shared_1.asUUID)('plan-hang'),
        lease: {
            leaseId: (0, shared_1.asUUID)('lease-hang'),
            subject: 'hanging-skill',
            capabilities: [],
            issuedAt: Date.now(),
            expiresAt: Date.now() + 60000,
            revoked: false,
        },
        cancellationToken: { isCancellationRequested: false, onCancelled: () => { } },
    };
    await node_assert_1.default.rejects(async () => {
        await executor.execute(task, { maxDurationMs: 20 });
    }, (err) => {
        return err.code === 'EXECUTION_TIMEOUT';
    });
    // Worker slot should be freed immediately
    node_assert_1.default.strictEqual(executor.getPoolStatus().activeWorkers, 0);
    await executor.shutdown();
    await loader.shutdown();
    await registry.shutdown();
});
//# sourceMappingURL=executor.test.js.map