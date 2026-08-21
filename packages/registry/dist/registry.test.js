"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const registry_js_1 = require("./registry.js");
const loader_js_1 = require("./loader.js");
const event_bus_1 = require("@agy/event-bus");
const sampleManifest = {
    id: 'security-audit',
    name: 'Security Audit',
    version: '2.0.0',
    description: 'Audits code changes for security vulnerabilities',
    priority: 'high',
    requires: [],
    optional: [],
    consumes: ['DiffArtifact'],
    produces: ['SecurityReport'],
    exclusiveWith: [],
    confidenceThreshold: 0.85,
    triggerPredicates: [],
    permissions: [{ name: 'fs:read', scope: '/project' }],
    capabilities: ['security', 'analysis'],
    entryPoint: 'src/index.ts',
};
(0, node_test_1.test)('SkillRegistry registers manifest and maintains inverted indices', async () => {
    const bus = new event_bus_1.EventBus();
    await bus.boot();
    const registry = new registry_js_1.SkillRegistry({ eventBus: bus });
    await registry.boot();
    const handle = await registry.register(sampleManifest);
    node_assert_1.default.strictEqual(handle.id, 'security-audit');
    node_assert_1.default.strictEqual(handle.version, '2.0.0');
    // Verify findByProduces inverted index
    const producers = registry.findByProduces('SecurityReport');
    node_assert_1.default.strictEqual(producers.length, 1);
    node_assert_1.default.strictEqual(producers[0].id, 'security-audit');
    // Verify findByCapability inverted index
    const secSkills = registry.findByCapability('security');
    node_assert_1.default.strictEqual(secSkills.length, 1);
    await registry.shutdown();
    await bus.shutdown();
});
(0, node_test_1.test)('SkillLoader loads and executes skill instances with drain lifecycle', async () => {
    const registry = new registry_js_1.SkillRegistry();
    await registry.boot();
    await registry.register(sampleManifest);
    const loader = new loader_js_1.SkillLoader({ registry });
    await loader.boot();
    const loaded = await loader.load('security-audit');
    node_assert_1.default.strictEqual(loaded.handle.lifecycleState, 'loaded');
    const result = (await loaded.execute({ test: 123 }));
    node_assert_1.default.strictEqual(result.skillId, 'security-audit');
    // Hot reload dual-host drain protocol
    const reloaded = await loader.reload('security-audit');
    node_assert_1.default.strictEqual(reloaded.handle.lifecycleState, 'loaded');
    await loader.shutdown();
    await registry.shutdown();
});
//# sourceMappingURL=registry.test.js.map