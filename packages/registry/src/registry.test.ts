import { test } from 'node:test';
import assert from 'node:assert';
import { SkillRegistry } from './registry.js';
import { SkillLoader } from './loader.js';
import { EventBus } from '@agy/event-bus';
import { SkillManifest, asSemVer } from '@agy/shared';

const sampleManifest: SkillManifest = {
  id: 'security-audit',
  name: 'Security Audit',
  version: asSemVer('2.0.0'),
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

test('SkillRegistry registers manifest and maintains inverted indices', async () => {
  const bus = new EventBus();
  await bus.boot();

  const registry = new SkillRegistry({ eventBus: bus });
  await registry.boot();

  const handle = await registry.register(sampleManifest);
  assert.strictEqual(handle.id, 'security-audit');
  assert.strictEqual(handle.version, '2.0.0');

  // Verify findByProduces inverted index
  const producers = registry.findByProduces('SecurityReport');
  assert.strictEqual(producers.length, 1);
  assert.strictEqual(producers[0].id, 'security-audit');

  // Verify findByCapability inverted index
  const secSkills = registry.findByCapability('security');
  assert.strictEqual(secSkills.length, 1);

  await registry.shutdown();
  await bus.shutdown();
});

test('SkillLoader loads and executes skill instances with drain lifecycle', async () => {
  const registry = new SkillRegistry();
  await registry.boot();
  await registry.register(sampleManifest);

  const loader = new SkillLoader({ registry });
  await loader.boot();

  const loaded = await loader.load('security-audit');
  assert.strictEqual(loaded.handle.lifecycleState, 'loaded');

  const result = (await loaded.execute({ test: 123 })) as { skillId: string };
  assert.strictEqual(result.skillId, 'security-audit');

  await loader.shutdown();
  await registry.shutdown();
});

test('SkillRegistry quarantines and rejects invalid manifests', async () => {
  const registry = new SkillRegistry();
  await registry.boot();

  await assert.rejects(
    async () => {
      await registry.register({} as any, 'corrupted/path');
    },
    (err: any) => {
      return err.code === 'MANIFEST_INVALID';
    }
  );

  const quarantined = registry.getQuarantined();
  assert.strictEqual(quarantined.length, 1);
  assert.strictEqual(quarantined[0].path, 'corrupted/path');

  await registry.shutdown();
});

test('SkillLoader acquires, releases, and drains instances properly during reload', async () => {
  const registry = new SkillRegistry();
  await registry.boot();
  await registry.register(sampleManifest);

  const loader = new SkillLoader({ registry });
  await loader.boot();

  // In-flight task acquires skill
  const instance1 = await loader.acquire('security-audit');
  assert.strictEqual(instance1.refCount, 1);

  // Reload while task is running
  const instance2 = await loader.reload('security-audit');
  assert.strictEqual(instance1.handle.lifecycleState, 'draining');
  assert.strictEqual(instance2.handle.lifecycleState, 'loaded');

  // Task completes and releases old instance
  await loader.release('security-audit');
  assert.strictEqual(instance1.handle.lifecycleState, 'unloaded');

  await loader.shutdown();
  await registry.shutdown();
});

test('SkillRegistry enforces manifest schema validation on register (SRC-16)', async () => {
  const registry = new SkillRegistry();
  await registry.boot();

  // Invalid SemVer version
  await assert.rejects(
    async () => {
      await registry.register({ ...sampleManifest, id: 'bad-version-skill', version: 'not-a-version' as any });
    },
    (err: any) => err.code === 'MANIFEST_INVALID'
  );

  // Invalid priority enum
  await assert.rejects(
    async () => {
      await registry.register({ ...sampleManifest, id: 'bad-priority-skill', priority: 'urgent' as any });
    },
    (err: any) => err.code === 'MANIFEST_INVALID'
  );

  // confidenceThreshold out of [0,1] range
  await assert.rejects(
    async () => {
      await registry.register({ ...sampleManifest, id: 'bad-threshold-skill', confidenceThreshold: 5 });
    },
    (err: any) => err.code === 'MANIFEST_INVALID'
  );

  // id violates the lowercase pattern
  await assert.rejects(
    async () => {
      await registry.register({ ...sampleManifest, id: 'UPPERCASE-ID' });
    },
    (err: any) => err.code === 'MANIFEST_INVALID'
  );

  const quarantined = registry.getQuarantined();
  assert.strictEqual(quarantined.length, 4, 'all four invalid manifests should be quarantined');
  // Each quarantine record should carry schema validation error details
  for (const record of quarantined) {
    assert.ok(record.errors.length > 0, 'quarantine record should include error details');
    assert.strictEqual(record.reason, 'Manifest failed schema validation');
  }

  await registry.shutdown();
});

test('SkillLoader enforces the drain timeout for unloading in-flight skills (SRC-18)', async () => {
  const registry = new SkillRegistry();
  await registry.boot();
  await registry.register(sampleManifest);

  const loader = new SkillLoader({ registry, drainTimeoutMs: 50 });
  await loader.boot();

  // Acquire an in-flight reference and unload. The skill enters 'draining'
  // without blocking, then is force-disposed after the drain timeout elapses.
  const instance = await loader.acquire('security-audit');
  assert.strictEqual(instance.refCount, 1);

  const result = await loader.unload('security-audit');
  assert.strictEqual(result, true);
  assert.strictEqual(instance.handle.lifecycleState, 'draining');

  // After the drain deadline, the background timer disposes the skill.
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.strictEqual(instance.handle.lifecycleState, 'unloaded');

  await loader.shutdown();
  await registry.shutdown();
});

test('SkillRegistry scans directory roots for manifests', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-scan-test-'));

  try {
    const skillDir = path.join(tempDir, 'my-scanned-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'manifest.json'),
      JSON.stringify({
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
        entryPoint: 'index.mjs',
      }),
      'utf-8'
    );
    fs.writeFileSync(path.join(skillDir, 'index.mjs'), 'export async function execute() { return { ok: true }; }', 'utf-8');

    const registry = new SkillRegistry();
    await registry.boot();

    const discovered = await registry.scan([tempDir]);
    assert.strictEqual(discovered.length, 1);
    assert.strictEqual(discovered[0].id, 'scanned-skill-1');
    assert.strictEqual(registry.findByProduces('ScannedReport').length, 1);

    await registry.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('SkillRegistry scan quarantines malformed manifests and recurses nested dirs (SRC-17)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-scan-nested-'));

  try {
    const validManifest = {
      id: 'nested-skill',
      name: 'Nested',
      version: '1.0.0',
      description: 'deeply nested',
      priority: 'medium',
      requires: [],
      optional: [],
      consumes: [],
      produces: ['NestedReport'],
      exclusiveWith: [],
      confidenceThreshold: 0.8,
      triggerPredicates: [],
      permissions: [],
      capabilities: ['nested'],
      entryPoint: 'index.mjs',
    };

    // Valid skill nested TWO levels deep (root/group/nested-skill/manifest.json).
    const deepDir = path.join(tempDir, 'group', 'nested-skill');
    fs.mkdirSync(deepDir, { recursive: true });
    fs.writeFileSync(path.join(deepDir, 'manifest.json'), JSON.stringify(validManifest), 'utf-8');
    fs.writeFileSync(path.join(deepDir, 'index.mjs'), 'export async function execute() { return { ok: true }; }', 'utf-8');

    // Malformed manifest one level deep.
    const badDir = path.join(tempDir, 'broken-skill');
    fs.mkdirSync(badDir, { recursive: true });
    fs.writeFileSync(path.join(badDir, 'manifest.json'), '{ this is not valid json', 'utf-8');

    const registry = new SkillRegistry();
    await registry.boot();
    const discovered = await registry.scan([tempDir]);

    // The deeply nested valid skill must be discovered (recursion).
    assert.strictEqual(discovered.length, 1);
    assert.strictEqual(discovered[0].id, 'nested-skill');
    assert.strictEqual(registry.findByProduces('NestedReport').length, 1);

    // The malformed manifest must be quarantined (not silently dropped).
    const quarantined = registry.getQuarantined();
    assert.strictEqual(quarantined.length, 1);
    assert.ok(quarantined[0].path.includes('broken-skill'));
    assert.ok(quarantined[0].errors.length > 0);

    await registry.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
