import { test } from 'node:test';
import assert from 'node:assert';
import { SkillResolver } from './resolver.js';
import { SkillRegistry } from '@agy/registry';
import { Goal } from './interfaces.js';
import { SkillManifest } from '@agy/shared';

const secSkill: SkillManifest = {
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

const docSkill: SkillManifest = {
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
  assert.strictEqual(res.diagnostics[0].includes('Exclusivity violation'), true);

  await resolver.shutdown();
  await registry.shutdown();
});
