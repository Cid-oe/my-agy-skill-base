"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const shared_1 = require("@agy/shared");
const fixtures_js_1 = require("./fixtures.js");
(0, node_test_1.test)('Testkit generates synthetic manifests and large catalogs', () => {
    const single = (0, fixtures_js_1.generateSyntheticManifest)('test-1');
    node_assert_1.default.strictEqual(single.id, 'test-1');
    node_assert_1.default.strictEqual(single.produces[0], 'Artifact-test-1');
    const catalog = (0, fixtures_js_1.generateSyntheticCatalog)(100);
    node_assert_1.default.strictEqual(catalog.length, 100);
    node_assert_1.default.strictEqual(catalog[99].id, 'skill-99');
});
(0, node_test_1.test)('End-to-End Multi-Subsystem Kernel Dataflow Integration', async () => {
    const { EventBus } = await import('@agy/event-bus');
    const { ArtifactStore } = await import('@agy/artifact');
    const { RuntimeState } = await import('@agy/runtime-state');
    const { PolicyEngine } = await import('@agy/policy');
    const { SkillRegistry, SkillLoader } = await import('@agy/registry');
    const { Executor } = await import('@agy/executor');
    const { SkillResolver } = await import('@agy/resolver');
    const { Scheduler } = await import('@agy/scheduler');
    const { Kernel } = await import('@agy/kernel');
    const bus = new EventBus();
    const artifactStore = new ArtifactStore({ eventBus: bus });
    const runtimeState = new RuntimeState({ eventBus: bus });
    const policyEngine = new PolicyEngine({ runtimeState });
    const registry = new SkillRegistry({ eventBus: bus });
    const loader = new SkillLoader({ registry, eventBus: bus });
    const executor = new Executor({ skillLoader: loader, artifactStore, policyEngine, eventBus: bus });
    const resolver = new SkillResolver();
    const scheduler = new Scheduler({ eventBus: bus, runtimeState });
    // Connect scheduler to executor
    scheduler.registerDispatcher(async (task, node) => {
        await executor.execute(task, node.limits);
    });
    const kernel = new Kernel();
    kernel.registerSubsystem(bus);
    kernel.registerSubsystem(artifactStore);
    kernel.registerSubsystem(runtimeState);
    kernel.registerSubsystem(policyEngine);
    kernel.registerSubsystem(registry);
    kernel.registerSubsystem(loader);
    kernel.registerSubsystem(executor);
    kernel.registerSubsystem(resolver);
    kernel.registerSubsystem(scheduler);
    const handle = await kernel.boot();
    node_assert_1.default.strictEqual(handle.state, 'ready');
    // Allow capability policy
    policyEngine.registerPolicy({
        name: 'AllowAllPolicy',
        priority: 10,
        evaluate: (req) => ({
            requestId: req.requestId,
            subject: req.subject,
            capability: req.capability,
            decision: 'allow',
            reason: 'E2E test permit',
            policyVersion: '1.0.0',
        }),
    });
    // Register pipeline skills
    const s1 = (0, fixtures_js_1.generateSyntheticManifest)('step-1', {
        produces: ['Art-Step1'],
        version: (0, shared_1.asSemVer)('1.0.0'),
    });
    const s2 = (0, fixtures_js_1.generateSyntheticManifest)('step-2', {
        requires: ['step-1'],
        produces: ['Art-Step2'],
        version: (0, shared_1.asSemVer)('1.0.0'),
    });
    await registry.register(s1);
    await registry.register(s2);
    // Resolve plan
    const res = await resolver.resolve({
        id: 'e2e-goal',
        kind: 'subtask',
        description: 'Run E2E pipeline',
        requiredArtifacts: ['Art-Step2'],
    }, registry);
    node_assert_1.default.strictEqual(res.status, 'resolved');
    node_assert_1.default.strictEqual(res.plan?.nodes.length, 2);
    // Submit and execute plan
    await scheduler.submit(res.plan);
    // Tick 1: step-1 executes
    const t1 = await scheduler.tick();
    node_assert_1.default.strictEqual(t1, 1);
    // Tick 2: step-2 executes
    const t2 = await scheduler.tick();
    node_assert_1.default.strictEqual(t2, 1);
    // Tick 3: plan completed
    await scheduler.tick();
    node_assert_1.default.strictEqual(scheduler.getPlanStatus(res.plan.planId), 'completed');
    // Verify health check
    const healthReport = await handle.health();
    node_assert_1.default.strictEqual(healthReport['kernel'].status, 'healthy');
    node_assert_1.default.strictEqual(healthReport['event-bus'].status, 'healthy');
    node_assert_1.default.strictEqual(healthReport['scheduler'].status, 'healthy');
    await handle.shutdown();
    node_assert_1.default.strictEqual(kernel.state, 'shutdown');
});
//# sourceMappingURL=testkit.test.js.map