import { test } from 'node:test';
import assert from 'node:assert';
import { asSemVer, SkillManifest } from '@agy/shared';
import { findArtifactPaths, rankSkills, searchSkills } from './skill-hunt.js';

const first: SkillManifest = {
  id: 'first', name: 'First', version: asSemVer('1.0.0'), description: 'first stage', priority: 'medium',
  requires: [], optional: [], consumes: ['Input'], produces: ['Middle'], exclusiveWith: [], confidenceThreshold: 0.8,
  triggerPredicates: [], permissions: [], capabilities: ['transform'], entryPoint: 'skill.mjs',
};

test('Skill Hunt helpers search, rank, and find bounded artifact paths', () => {
  const second: SkillManifest = { ...first, id: 'second', consumes: ['Middle'], produces: ['Output'], description: 'final stage' };
  assert.deepStrictEqual(searchSkills([first, second], 'final').map((skill) => skill.id), ['second']);
  assert.strictEqual(rankSkills([first], 'Middle')[0].score, 78);
  assert.deepStrictEqual(findArtifactPaths([first, second], 'Input', 'Output'), [[
    { skillId: 'first', outputArtifact: 'Middle' },
    { skillId: 'second', outputArtifact: 'Output' },
  ]]);
});
