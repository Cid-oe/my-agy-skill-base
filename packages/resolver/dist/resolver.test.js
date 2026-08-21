"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const resolver_js_1 = require("./resolver.js");
const registry_1 = require("@agy/registry");
const secSkill = {
    id: 'security-audit',
    name: 'Security Audit',
    version: '1.0.0',
    description: 'Audits code changes for security',
    priority: 'high',
    requires: [],
    optional: [],
    consumes: [],
    produces: ['SecurityReport'],
    exclusiveWith: [],
    confidenceThreshold: 0.9,
    triggerPredicates: [{ variable: 'riskLevel', operator: '==', value: 'high' }],
    permissions: [],
    capabilities: ['security'],
    entryPoint: 'index.ts',
};
const docSkill = {
    id: 'doc-sync',
    name: 'Doc Sync',
    version: '1.0.0',
    description: 'Syncs docs',
    priority: 'medium',
    requires: [],
    optional: [],
    consumes: [],
    produces: ['DocsReport'],
    exclusiveWith: [],
    confidenceThreshold: 0.8,
    triggerPredicates: [],
    permissions: [],
    capabilities: ['docs'],
    entryPoint: 'index.ts',
};
(0, node_test_1.test)('SkillResolver resolves goal artifacts into DAG ExecutionPlan', async () => {
    const registry = new registry_1.SkillRegistry();
    await registry.boot();
    await registry.register(secSkill);
    await registry.register(docSkill);
    const resolver = new resolver_js_1.SkillResolver();
    await resolver.boot();
    const goal = {
        id: 'goal-1',
        kind: 'subtask',
        description: 'Run docs and security audits',
        requiredArtifacts: ['DocsReport', 'SecurityReport'],
    };
    const result = await resolver.resolve(goal, registry, {
        variables: { riskLevel: 'high' },
    });
    node_assert_1.default.strictEqual(result.status, 'resolved');
    node_assert_1.default.notStrictEqual(result.plan, null);
    node_assert_1.default.strictEqual(result.plan?.nodes.length, 2);
    const explanation = resolver.explainPlan(result.plan);
    node_assert_1.default.strictEqual(explanation.includes('security-audit'), true);
    await resolver.shutdown();
    await registry.shutdown();
});
(0, node_test_1.test)('SkillResolver rejects mutually exclusive skills in plan', async () => {
    const registry = new registry_1.SkillRegistry();
    await registry.boot();
    const caveman = {
        ...docSkill,
        id: 'caveman-mode',
        produces: ['CodeOutput'],
        exclusiveWith: ['ponytail-mode'],
    };
    const ponytail = {
        ...docSkill,
        id: 'ponytail-mode',
        produces: ['ExtraOutput'],
        exclusiveWith: ['caveman-mode'],
    };
    await registry.register(caveman);
    await registry.register(ponytail);
    const resolver = new resolver_js_1.SkillResolver();
    await resolver.boot();
    const goal = {
        id: 'goal-exclusive',
        kind: 'subtask',
        description: 'Run conflicting skills',
        requiredArtifacts: ['CodeOutput', 'ExtraOutput'],
    };
    const res = await resolver.resolve(goal, registry);
    node_assert_1.default.strictEqual(res.status, 'unresolvable');
    node_assert_1.default.strictEqual(res.diagnostics[0].includes('Exclusivity violation'), true);
    await resolver.shutdown();
    await registry.shutdown();
});
//# sourceMappingURL=resolver.test.js.map