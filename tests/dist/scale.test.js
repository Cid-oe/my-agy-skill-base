"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const registry_1 = require("@agy/registry");
const resolver_1 = require("@agy/resolver");
const testkit_1 = require("@agy/testkit");
(0, node_test_1.test)('Scale Benchmark: Resolves against 1,000 synthetic skills in under 50ms', async () => {
    const registry = new registry_1.SkillRegistry();
    await registry.boot();
    const catalog = (0, testkit_1.generateSyntheticCatalog)(1000);
    for (const manifest of catalog) {
        await registry.register(manifest);
    }
    const resolver = new resolver_1.SkillResolver();
    await resolver.boot();
    const start = performance.now();
    const result = await resolver.resolve({
        id: 'scale-goal',
        kind: 'subtask',
        description: 'Resolve in 1000 skill catalog',
        requiredArtifacts: ['Artifact-500'],
    }, registry);
    const duration = performance.now() - start;
    node_assert_1.default.strictEqual(result.status, 'resolved');
    node_assert_1.default.strictEqual(result.plan?.nodes[0].skillRef.id, 'skill-500');
    node_assert_1.default.strictEqual(duration < 50, true, `Resolution took ${duration}ms, expected < 50ms`);
    await resolver.shutdown();
    await registry.shutdown();
});
//# sourceMappingURL=scale.test.js.map