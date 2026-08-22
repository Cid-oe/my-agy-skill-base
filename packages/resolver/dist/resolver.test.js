"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const resolver_js_1 = require("./resolver.js");
const registry_1 = require("@agy/registry");
const shared_1 = require("@agy/shared");
const secSkill = {
    id: 'security-audit',
    name: 'Security Audit',
    version: (0, shared_1.asSemVer)('1.0.0'),
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
    version: (0, shared_1.asSemVer)('1.0.0'),
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
    node_assert_1.default.strictEqual(res.diagnostics[0].includes('Exclusivity'), true);
    await resolver.shutdown();
    await registry.shutdown();
});
(0, node_test_1.test)('SkillResolver resolves transitive dependency pipelines (S3 -> S2 -> S1)', async () => {
    const registry = new registry_1.SkillRegistry();
    await registry.boot();
    const s1 = { ...docSkill, id: 'skill-1', produces: ['Art-1'], requires: [] };
    const s2 = { ...docSkill, id: 'skill-2', produces: ['Art-2'], requires: ['skill-1'] };
    const s3 = { ...docSkill, id: 'skill-3', produces: ['Art-3'], requires: ['skill-2'] };
    await registry.register(s1);
    await registry.register(s2);
    await registry.register(s3);
    const resolver = new resolver_js_1.SkillResolver();
    await resolver.boot();
    const goal = {
        id: 'goal-transitive',
        kind: 'subtask',
        description: 'Resolve transitive pipeline',
        requiredArtifacts: ['Art-3'],
    };
    const res = await resolver.resolve(goal, registry);
    node_assert_1.default.strictEqual(res.status, 'resolved');
    node_assert_1.default.strictEqual(res.plan?.nodes.length, 3);
    node_assert_1.default.strictEqual(res.plan?.edges.length, 2);
    await resolver.shutdown();
    await registry.shutdown();
});
(0, node_test_1.test)('SkillResolver backtracks to alternate candidates upon exclusivity conflicts', async () => {
    const registry = new registry_1.SkillRegistry();
    await registry.boot();
    // Primary candidates conflict with each other
    const candA1 = { ...docSkill, id: 'cand-A1', priority: 'high', produces: ['Out-A'], exclusiveWith: ['cand-B1'] };
    const candA2 = { ...docSkill, id: 'cand-A2', priority: 'medium', produces: ['Out-A'] };
    const candB1 = { ...docSkill, id: 'cand-B1', priority: 'high', produces: ['Out-B'], exclusiveWith: ['cand-A1'] };
    await registry.register(candA1);
    await registry.register(candA2);
    await registry.register(candB1);
    const resolver = new resolver_js_1.SkillResolver();
    await resolver.boot();
    const goal = {
        id: 'goal-backtrack',
        kind: 'subtask',
        description: 'Resolve with backtracking',
        requiredArtifacts: ['Out-A', 'Out-B'],
    };
    const res = await resolver.resolve(goal, registry);
    node_assert_1.default.strictEqual(res.status, 'resolved');
    node_assert_1.default.strictEqual(res.plan?.nodes.length, 2);
    // cand-A2 should have been chosen to avoid exclusivity with cand-B1
    const nodeIds = res.plan?.nodes.map((n) => n.skillRef.id);
    node_assert_1.default.strictEqual(nodeIds?.includes('cand-A2'), true);
    node_assert_1.default.strictEqual(nodeIds?.includes('cand-B1'), true);
    await resolver.shutdown();
    await registry.shutdown();
});
(0, node_test_1.test)('SkillResolver detects cycles in dependency graph and rejects plan', async () => {
    const registry = new registry_1.SkillRegistry();
    await registry.boot();
    const cycA = { ...docSkill, id: 'cycle-A', produces: ['CycOut'], requires: ['cycle-B'] };
    const cycB = { ...docSkill, id: 'cycle-B', produces: ['CycInternal'], requires: ['cycle-A'] };
    await registry.register(cycA);
    await registry.register(cycB);
    const resolver = new resolver_js_1.SkillResolver();
    await resolver.boot();
    const goal = {
        id: 'goal-cycle',
        kind: 'subtask',
        description: 'Resolve cyclic graph',
        requiredArtifacts: ['CycOut'],
    };
    const res = await resolver.resolve(goal, registry);
    node_assert_1.default.strictEqual(res.status, 'unresolvable');
    node_assert_1.default.strictEqual(res.diagnostics[0].includes('Cycle detected'), true);
    await resolver.shutdown();
    await registry.shutdown();
});
(0, node_test_1.test)('SkillResolver reresolve produces a new immutable plan instance', async () => {
    const registry = new registry_1.SkillRegistry();
    await registry.boot();
    const base = { ...docSkill, id: 'base-skill', produces: ['BaseOut'] };
    const alt = { ...docSkill, id: 'alt-skill', priority: 'low', produces: ['BaseOut'] };
    await registry.register(base);
    await registry.register(alt);
    const resolver = new resolver_js_1.SkillResolver();
    await resolver.boot();
    const res = await resolver.resolve({ id: 'g1', kind: 'subtask', description: 'desc', requiredArtifacts: ['BaseOut'] }, registry);
    const originalPlan = res.plan;
    const failedNodeId = originalPlan.nodes[0].nodeId;
    const reresolveRes = await resolver.reresolve(originalPlan, failedNodeId);
    node_assert_1.default.strictEqual(reresolveRes.status, 'resolved');
    node_assert_1.default.notStrictEqual(reresolveRes.plan, originalPlan);
    node_assert_1.default.notStrictEqual(reresolveRes.plan?.planId, originalPlan.planId);
    // Original plan is untouched
    node_assert_1.default.strictEqual(originalPlan.nodes[0].skillRef.id, 'base-skill');
    // New plan has substituted skill
    node_assert_1.default.strictEqual(reresolveRes.plan?.nodes[0].skillRef.id, 'alt-skill');
    await resolver.shutdown();
    await registry.shutdown();
});
//# sourceMappingURL=resolver.test.js.map