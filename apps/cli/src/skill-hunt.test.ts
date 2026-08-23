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
  const ranked = rankSkills([first], 'Middle');
  assert.strictEqual(ranked[0].score, 78);
  assert.deepStrictEqual(ranked[0].reasons, ['+50 produces Middle', '+8 confidence', '+20 no permissions required']);
  assert.deepStrictEqual(findArtifactPaths([first, second], 'Input', 'Output'), [[
    { skillId: 'first', outputArtifact: 'Middle' },
    { skillId: 'second', outputArtifact: 'Output' },
  ]]);
});

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { validateSkillDirectory } from './skill-hunt.js';

test('validateSkillDirectory handles valid and invalid directories', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-skill-validate-'));
  try {
    const invalidDir = path.join(tempDir, 'invalid');
    fs.mkdirSync(invalidDir, { recursive: true });
    
    let result = validateSkillDirectory(invalidDir);
    assert.strictEqual(result.score, 0);
    assert.ok(result.lines[0].includes('FAIL manifest.json is missing'));

    const validDir = path.join(tempDir, 'valid');
    fs.mkdirSync(validDir, { recursive: true });
    fs.writeFileSync(path.join(validDir, 'manifest.json'), JSON.stringify(first));
    fs.writeFileSync(path.join(validDir, 'skill.mjs'), '');
    fs.writeFileSync(path.join(validDir, 'README.md'), '');
    
    result = validateSkillDirectory(validDir);
    assert.strictEqual(result.score, 100);
    assert.ok(result.lines.some(l => l.startsWith('PASS manifest')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
