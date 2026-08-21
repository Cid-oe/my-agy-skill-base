import { test } from 'node:test';
import assert from 'node:assert';
import { createCliRuntime, handleCliCommand } from './cli.js';
import { SkillManifest } from '@agy/shared';

test('CLI status command inspects runtime and subsystems', async () => {
  const rt = await createCliRuntime();
  const res = await handleCliCommand(['status'], rt);

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.output.includes('=== AGY Kernel Status ==='), true);
  assert.strictEqual(res.output.includes('kernel: healthy'), true);

  await rt.kernel.shutdown();
});

test('CLI skill install and run executes full end-to-end workflow', async () => {
  const rt = await createCliRuntime();

  const manifest: SkillManifest = {
    id: 'cli-sample-skill',
    name: 'CLI Sample Skill',
    version: '1.0.0',
    description: 'Executes sample workflow',
    priority: 'high',
    requires: [],
    optional: [],
    consumes: [],
    produces: ['SampleArtifact'],
    exclusiveWith: [],
    confidenceThreshold: 0.9,
    triggerPredicates: [],
    permissions: [],
    capabilities: ['workflow'],
    entryPoint: 'index.ts',
  };

  const installRes = await handleCliCommand(['skill', 'install', JSON.stringify(manifest)], rt);
  assert.strictEqual(installRes.success, true);
  assert.strictEqual(installRes.output.includes('Installed skill cli-sample-skill@1.0.0'), true);

  const runRes = await handleCliCommand(['run', 'Process data', 'SampleArtifact'], rt);
  assert.strictEqual(runRes.success, true);
  assert.strictEqual(runRes.output.includes('Executed plan'), true);

  await rt.kernel.shutdown();
});
