import { test } from 'node:test';
import assert from 'node:assert';
import { ArtifactStore } from './artifact-store.js';
import { EventBus } from '@agy/event-bus';

test('ArtifactStore puts content and computes deterministic SHA-256 hash', async () => {
  const bus = new EventBus();
  await bus.boot();

  const store = new ArtifactStore({ eventBus: bus });
  await store.boot();

  const content = 'Deterministic Artifact Payload';
  const envelope = await store.put(content, { type: 'PRD' });

  assert.strictEqual(typeof envelope.hash, 'string');
  assert.strictEqual(envelope.hash.length, 64);
  assert.strictEqual(envelope.size, Buffer.from(content).length);

  // Retrieve content
  const retrieved = await store.get(envelope.hash);
  assert.notStrictEqual(retrieved, null);
  assert.strictEqual(retrieved?.toString('utf-8'), content);

  await store.shutdown();
  await bus.shutdown();
});

test('ArtifactStore deduplicates identical content and manages ref counts', async () => {
  const store = new ArtifactStore();
  await store.boot();

  const env1 = await store.put('Shared Text Payload');
  const env2 = await store.put('Shared Text Payload');

  assert.strictEqual(env1.hash, env2.hash);
  assert.strictEqual(env2.refCount, 2);

  // Decrement
  await store.decrementRefCount(env1.hash);
  await store.decrementRefCount(env1.hash);

  // GC cleans up 0 refCount artifacts
  const gcReport = await store.gc();
  assert.strictEqual(gcReport.deletedCount, 1);

  const missing = await store.get(env1.hash);
  assert.strictEqual(missing, null);

  await store.shutdown();
});

test('ArtifactStore respects pinned artifacts during GC', async () => {
  const store = new ArtifactStore();
  await store.boot();

  const env = await store.put('Pinned Content');
  await store.pin(env.hash);
  await store.decrementRefCount(env.hash); // refCount = 0, but pinned

  const report = await store.gc();
  assert.strictEqual(report.deletedCount, 0);

  const stillThere = await store.get(env.hash);
  assert.notStrictEqual(stillThere, null);

  await store.shutdown();
});
