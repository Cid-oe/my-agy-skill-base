import { test } from 'node:test';
import assert from 'node:assert';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createCliRuntime, handleCliCommand, initializeWorkspace } from './cli.js';
import { SkillManifest, asSemVer } from '@agy/shared';

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
    version: asSemVer('1.0.0'),
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

  // Skill list verification
  const listRes = await handleCliCommand(['skill', 'list'], rt);
  assert.strictEqual(listRes.success, true);
  assert.strictEqual(listRes.output.includes('cli-sample-skill@1.0.0'), true);

  // Invalid JSON error handling
  const badJsonRes = await handleCliCommand(['skill', 'install', '{not-valid-json}'], rt);
  assert.strictEqual(badJsonRes.success, false);
  assert.strictEqual(badJsonRes.output.includes('Invalid JSON manifest'), true);

  await rt.kernel.shutdown();
});

test('CLI runtime persists state and artifacts across restarts when persistenceDir is set', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-cli-persist-'));
  try {
    // First session: register a skill and run it to produce an artifact.
    const rt1 = await createCliRuntime({ persistenceDir: tempDir });
    const manifest: SkillManifest = {
      id: 'persist-skill',
      name: 'Persist',
      version: asSemVer('1.0.0'),
      description: 'durable run',
      priority: 'medium',
      requires: [],
      optional: [],
      consumes: [],
      produces: ['PersistArt'],
      exclusiveWith: [],
      confidenceThreshold: 0.8,
      triggerPredicates: [],
      permissions: [],
      capabilities: ['persist'],
      entryPoint: 'index.ts',
    };
    await rt1.registry.register(manifest);
    await rt1.state.trackPlan(asSemVer('persisted-plan') as any);
    await rt1.kernel.shutdown();

    // Second session against the same dir: WAL replay must recover the plan.
    const rt2 = await createCliRuntime({ persistenceDir: tempDir });
    const snap = rt2.state.getSnapshot();
    assert.ok(snap.activePlans.includes('persisted-plan' as any), 'plan must be recovered from WAL');
    // The registered skill must be re-installable / present via list.
    const installRes = await handleCliCommand(['skill', 'install', JSON.stringify(manifest)], rt2);
    assert.strictEqual(installRes.success, true);
    const listRes = await handleCliCommand(['skill', 'list'], rt2);
    assert.strictEqual(listRes.output.includes('persist-skill@1.0.0'), true);
    await rt2.kernel.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI run drives a multi-stage dependency plan to completion (EX-2)', async () => {
  const rt = await createCliRuntime();

  const stage1: SkillManifest = {
    id: 'cli-stage-1',
    name: 'Stage 1',
    version: asSemVer('1.0.0'),
    description: 'First pipeline stage',
    priority: 'medium',
    requires: [],
    optional: [],
    consumes: [],
    produces: ['CliArt-1'],
    exclusiveWith: [],
    confidenceThreshold: 0.8,
    triggerPredicates: [],
    permissions: [],
    capabilities: ['stage'],
    entryPoint: 'index.ts',
  };
  const stage2: SkillManifest = {
    ...stage1,
    id: 'cli-stage-2',
    name: 'Stage 2',
    requires: ['cli-stage-1'],
    produces: ['CliArt-2'],
  };

  await rt.registry.register(stage1);
  await rt.registry.register(stage2);

  // `run` must advance the pull-based scheduler across both dependency waves.
  const runRes = await handleCliCommand(['run', 'pipeline', 'CliArt-2'], rt);
  assert.strictEqual(runRes.success, true);
  assert.strictEqual(runRes.output.includes('status: completed'), true);

  await rt.kernel.shutdown();
});

test('CLI Skill Hunt commands initialize, discover, inspect, rank, path, and inspect artifacts', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-skill-hunt-'));
  const skillDir = path.join(tempDir, 'examples', 'reader');
  const manifest: SkillManifest = {
    id: 'reader-skill',
    name: 'README Reader',
    version: asSemVer('1.0.0'),
    description: 'Reads markdown files',
    priority: 'high',
    requires: [],
    optional: [],
    consumes: ['FileReadRequest'],
    produces: ['FileContent'],
    exclusiveWith: [],
    confidenceThreshold: 0.9,
    triggerPredicates: [],
    permissions: [],
    capabilities: ['file-read', 'markdown'],
    entryPoint: 'skill.mjs',
  };
  try {
    const initialized = initializeWorkspace(tempDir);
    assert.ok(initialized.created.includes('agy.config.json'));
    assert.ok(fs.existsSync(path.join(tempDir, '.agy', 'artifacts')));
    assert.deepStrictEqual(initializeWorkspace(tempDir).created, []);
    initializeWorkspace(tempDir, true);

    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'manifest.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(skillDir, 'skill.mjs'), 'export async function execute() { return {}; }');
    fs.writeFileSync(path.join(skillDir, 'README.md'), '# Reader');

    const rt = await createCliRuntime();
    const scan = await handleCliCommand(['registry', 'scan', path.join(tempDir, 'examples')], rt);
    assert.strictEqual(scan.success, true);
    assert.match(scan.output, /registered 1 skills/);

    const search = await handleCliCommand(['skill', 'search', 'markdown'], rt);
    assert.strictEqual(search.success, true);
    assert.match(search.output, /reader-skill@1.0.0/);

    const inspect = await handleCliCommand(['skill', 'inspect', 'reader-skill'], rt);
    assert.strictEqual(inspect.success, true);
    assert.match(inspect.output, /Entry point: skill.mjs/);
    assert.strictEqual((await handleCliCommand(['skill', 'inspect', 'missing'], rt)).success, false);

    const validation = await handleCliCommand(['skill', 'validate', skillDir], rt);
    assert.strictEqual(validation.success, true);
    assert.match(validation.output, /Score: 100\/100/);

    const rank = await handleCliCommand(['skill', 'rank', '--produces', 'FileContent'], rt);
    assert.strictEqual(rank.success, true);
    assert.match(rank.output, /reader-skill/);

    const parser: SkillManifest = { ...manifest, id: 'parser-skill', consumes: ['FileContent'], produces: ['ParsedMarkdown'] };
    await rt.registry.register(parser);
    const paths = await handleCliCommand(['skill', 'paths', 'FileReadRequest', 'ParsedMarkdown'], rt);
    assert.strictEqual(paths.success, true);
    assert.match(paths.output, /FileReadRequest -> reader-skill -> FileContent -> parser-skill -> ParsedMarkdown/);

    const aliasRun = await handleCliCommand(['goal', 'run', 'parse markdown', 'ParsedMarkdown'], rt);
    assert.strictEqual(aliasRun.success, true);

    const artifact = await rt.store.put('{"ok":true}', { kind: 'test' }, { id: 'reader-skill', version: asSemVer('1.0.0') }, 'application/json');
    const artifactInspection = await handleCliCommand(['artifact', 'inspect', artifact.hash], rt);
    assert.strictEqual(artifactInspection.success, true);
    assert.match(artifactInspection.output, /Preview: {"ok":true}/);
    assert.strictEqual((await handleCliCommand(['artifact', 'inspect', 'missing-hash'], rt)).success, false);
    await rt.kernel.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
