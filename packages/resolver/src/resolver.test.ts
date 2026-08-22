import { test } from 'node:test';
import assert from 'node:assert';
import { SkillResolver } from './resolver.js';
import { SkillRegistry } from '@agy/registry';
import { Goal } from './interfaces.js';
import { SkillManifest, asSemVer } from '@agy/shared';

const secSkill: SkillManifest = {
  id: 'security-audit',
  name: 'Security Audit',
  version: asSemVer('1.0.0'),
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

const docSkill: SkillManifest = {
  id: 'doc-sync',
  name: 'Doc Sync',
  version: asSemVer('1.0.0'),
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

test('SkillResolver resolves goal artifacts into DAG ExecutionPlan', async () => {
  const registry = new SkillRegistry();
  await registry.boot();
  await registry.register(secSkill);
  await registry.register(docSkill);

  const resolver = new SkillResolver();
  await resolver.boot();

  const goal: Goal = {
    id: 'goal-1',
    kind: 'subtask',
    description: 'Run docs and security audits',
    requiredArtifacts: ['DocsReport', 'SecurityReport'],
  };

  const result = await resolver.resolve(goal, registry, {
    variables: { riskLevel: 'high' },
  });

  assert.strictEqual(result.status, 'resolved');
  assert.notStrictEqual(result.plan, null);
  assert.strictEqual(result.plan?.nodes.length, 2);

  const explanation = resolver.explainPlan(result.plan!);
  assert.strictEqual(explanation.includes('security-audit'), true);

  await resolver.shutdown();
  await registry.shutdown();
});

test('SkillResolver rejects mutually exclusive skills in plan', async () => {
  const registry = new SkillRegistry();
  await registry.boot();

  const caveman: SkillManifest = {
    ...docSkill,
    id: 'caveman-mode',
    produces: ['CodeOutput'],
    exclusiveWith: ['ponytail-mode'],
  };

  const ponytail: SkillManifest = {
    ...docSkill,
    id: 'ponytail-mode',
    produces: ['ExtraOutput'],
    exclusiveWith: ['caveman-mode'],
  };

  await registry.register(caveman);
  await registry.register(ponytail);

  const resolver = new SkillResolver();
  await resolver.boot();

  const goal: Goal = {
    id: 'goal-exclusive',
    kind: 'subtask',
    description: 'Run conflicting skills',
    requiredArtifacts: ['CodeOutput', 'ExtraOutput'],
  };

  const res = await resolver.resolve(goal, registry);
  assert.strictEqual(res.status, 'unresolvable');
  assert.strictEqual(res.diagnostics[0].includes('Exclusivity'), true);

  await resolver.shutdown();
  await registry.shutdown();
});

test('SkillResolver resolves transitive dependency pipelines (S3 -> S2 -> S1)', async () => {
  const registry = new SkillRegistry();
  await registry.boot();

  const s1: SkillManifest = { ...docSkill, id: 'skill-1', produces: ['Art-1'], requires: [] };
  const s2: SkillManifest = { ...docSkill, id: 'skill-2', produces: ['Art-2'], requires: ['skill-1'] };
  const s3: SkillManifest = { ...docSkill, id: 'skill-3', produces: ['Art-3'], requires: ['skill-2'] };

  await registry.register(s1);
  await registry.register(s2);
  await registry.register(s3);

  const resolver = new SkillResolver();
  await resolver.boot();

  const goal: Goal = {
    id: 'goal-transitive',
    kind: 'subtask',
    description: 'Resolve transitive pipeline',
    requiredArtifacts: ['Art-3'],
  };

  const res = await resolver.resolve(goal, registry);
  assert.strictEqual(res.status, 'resolved');
  assert.strictEqual(res.plan?.nodes.length, 3);
  assert.strictEqual(res.plan?.edges.length, 2);

  await resolver.shutdown();
  await registry.shutdown();
});

test('SkillResolver backtracks to alternate candidates upon exclusivity conflicts', async () => {
  const registry = new SkillRegistry();
  await registry.boot();

  // Primary candidates conflict with each other
  const candA1: SkillManifest = { ...docSkill, id: 'cand-a1', priority: 'high', produces: ['Out-A'], exclusiveWith: ['cand-b1'] };
  const candA2: SkillManifest = { ...docSkill, id: 'cand-a2', priority: 'medium', produces: ['Out-A'] };
  const candB1: SkillManifest = { ...docSkill, id: 'cand-b1', priority: 'high', produces: ['Out-B'], exclusiveWith: ['cand-a1'] };

  await registry.register(candA1);
  await registry.register(candA2);
  await registry.register(candB1);

  const resolver = new SkillResolver();
  await resolver.boot();

  const goal: Goal = {
    id: 'goal-backtrack',
    kind: 'subtask',
    description: 'Resolve with backtracking',
    requiredArtifacts: ['Out-A', 'Out-B'],
  };

  const res = await resolver.resolve(goal, registry);
  assert.strictEqual(res.status, 'resolved');
  assert.strictEqual(res.plan?.nodes.length, 2);
  // cand-a2 should have been chosen to avoid exclusivity with cand-b1
  const nodeIds = res.plan?.nodes.map((n) => n.skillRef.id);
  assert.strictEqual(nodeIds?.includes('cand-a2'), true);
  assert.strictEqual(nodeIds?.includes('cand-b1'), true);

  await resolver.shutdown();
  await registry.shutdown();
});

test('SkillResolver detects cycles in dependency graph and rejects plan', async () => {
  const registry = new SkillRegistry();
  await registry.boot();

  const cycA: SkillManifest = { ...docSkill, id: 'cycle-a', produces: ['CycOut'], requires: ['cycle-b'] };
  const cycB: SkillManifest = { ...docSkill, id: 'cycle-b', produces: ['CycInternal'], requires: ['cycle-a'] };

  await registry.register(cycA);
  await registry.register(cycB);

  const resolver = new SkillResolver();
  await resolver.boot();

  const goal: Goal = {
    id: 'goal-cycle',
    kind: 'subtask',
    description: 'Resolve cyclic graph',
    requiredArtifacts: ['CycOut'],
  };

  const res = await resolver.resolve(goal, registry);
  assert.strictEqual(res.status, 'unresolvable');
  assert.strictEqual(res.diagnostics[0].includes('Cycle detected'), true);

  await resolver.shutdown();
  await registry.shutdown();
});

test('SkillResolver reresolve produces a new immutable plan instance', async () => {
  const registry = new SkillRegistry();
  await registry.boot();

  const base: SkillManifest = { ...docSkill, id: 'base-skill', produces: ['BaseOut'] };
  const alt: SkillManifest = { ...docSkill, id: 'alt-skill', priority: 'low', produces: ['BaseOut'] };

  await registry.register(base);
  await registry.register(alt);

  const resolver = new SkillResolver();
  await resolver.boot();

  const res = await resolver.resolve(
    { id: 'g1', kind: 'subtask', description: 'desc', requiredArtifacts: ['BaseOut'] },
    registry
  );

  const originalPlan = res.plan!;
  const failedNodeId = originalPlan.nodes[0].nodeId;

  const reresolveRes = await resolver.reresolve(originalPlan, failedNodeId);
  assert.strictEqual(reresolveRes.status, 'resolved');
  assert.notStrictEqual(reresolveRes.plan, originalPlan);
  assert.notStrictEqual(reresolveRes.plan?.planId, originalPlan.planId);
  // Original plan is untouched
  assert.strictEqual(originalPlan.nodes[0].skillRef.id, 'base-skill');
  // New plan has substituted skill
  assert.strictEqual(reresolveRes.plan?.nodes[0].skillRef.id, 'alt-skill');

  await resolver.shutdown();
  await registry.shutdown();
});
