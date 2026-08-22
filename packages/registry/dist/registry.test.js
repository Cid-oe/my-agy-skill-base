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
const shared_1 = require("@agy/shared");
const sampleManifest = {
    id: 'security-audit',
    name: 'Security Audit',
    version: (0, shared_1.asSemVer)('2.0.0'),
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
    await loader.shutdown();
    await registry.shutdown();
});
(0, node_test_1.test)('SkillRegistry quarantines and rejects invalid manifests', async () => {
    const registry = new registry_js_1.SkillRegistry();
    await registry.boot();
    await node_assert_1.default.rejects(async () => {
        await registry.register({}, 'corrupted/path');
    }, (err) => {
        return err.code === 'MANIFEST_INVALID';
    });
    const quarantined = registry.getQuarantined();
    node_assert_1.default.strictEqual(quarantined.length, 1);
    node_assert_1.default.strictEqual(quarantined[0].path, 'corrupted/path');
    await registry.shutdown();
});
(0, node_test_1.test)('SkillLoader acquires, releases, and drains instances properly during reload', async () => {
    const registry = new registry_js_1.SkillRegistry();
    await registry.boot();
    await registry.register(sampleManifest);
    const loader = new loader_js_1.SkillLoader({ registry });
    await loader.boot();
    // In-flight task acquires skill
    const instance1 = await loader.acquire('security-audit');
    node_assert_1.default.strictEqual(instance1.refCount, 1);
    // Reload while task is running
    const instance2 = await loader.reload('security-audit');
    node_assert_1.default.strictEqual(instance1.handle.lifecycleState, 'draining');
    node_assert_1.default.strictEqual(instance2.handle.lifecycleState, 'loaded');
    // Task completes and releases old instance
    await loader.release('security-audit');
    node_assert_1.default.strictEqual(instance1.handle.lifecycleState, 'unloaded');
    await loader.shutdown();
    await registry.shutdown();
});
(0, node_test_1.test)('SkillRegistry scans directory roots for manifests', async () => {
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-scan-test-'));
    try {
        const skillDir = path.join(tempDir, 'my-scanned-skill');
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, 'manifest.json'), JSON.stringify({
            id: 'scanned-skill-1',
            name: 'Scanned Skill',
            version: '1.0.0',
            description: 'Auto scanned skill',
            priority: 'medium',
            requires: [],
            optional: [],
            consumes: [],
            produces: ['ScannedReport'],
            exclusiveWith: [],
            confidenceThreshold: 0.8,
            triggerPredicates: [],
            permissions: [],
            capabilities: ['scanner'],
            entryPoint: 'index.ts',
        }), 'utf-8');
        const registry = new registry_js_1.SkillRegistry();
        await registry.boot();
        const discovered = await registry.scan([tempDir]);
        node_assert_1.default.strictEqual(discovered.length, 1);
        node_assert_1.default.strictEqual(discovered[0].id, 'scanned-skill-1');
        node_assert_1.default.strictEqual(registry.findByProduces('ScannedReport').length, 1);
        await registry.shutdown();
    }
    finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=registry.test.js.map