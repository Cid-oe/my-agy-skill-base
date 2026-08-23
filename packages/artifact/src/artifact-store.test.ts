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

  // Unpin and re-run GC
  await store.unpin(env.hash);
  const unpinnedReport = await store.gc();
  assert.strictEqual(unpinnedReport.deletedCount, 1);
  assert.strictEqual(await store.get(env.hash), null);

  await store.shutdown();
});

test('ArtifactStore supports streaming reads and writes', async () => {
  const store = new ArtifactStore();
  await store.boot();

  const streamContent = 'Streaming large artifact content payload';
  const { Readable } = await import('node:stream');
  const readStream = Readable.from(Buffer.from(streamContent));

  const envelope = await store.putStream(readStream, { type: 'STREAM_TEST' });
  assert.strictEqual(envelope.size, Buffer.from(streamContent).length);

  const outStream = await store.getStream(envelope.hash);
  assert.notStrictEqual(outStream, null);

  const chunks: Buffer[] = [];
  for await (const chunk of outStream!) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const result = Buffer.concat(chunks).toString('utf-8');
  assert.strictEqual(result, streamContent);

  await store.shutdown();
});

test('ArtifactStore validates SHA-256 integrity on read and rejects corrupted blobs', async () => {
  const store = new ArtifactStore();
  await store.boot();

  const envelope = await store.put('Original Content');
  
  // Intentionally mutate internal blob storage
  const corruptedBuffer = Buffer.from('Tampered Content');
  (store as any)._blobs.set(envelope.hash, corruptedBuffer);

  await assert.rejects(
    async () => {
      await store.get(envelope.hash);
    },
    (err: any) => {
      return err.code === 'ARTIFACT_CORRUPTED';
    }
  );

  await store.shutdown();
});

test('ArtifactStore persists blobs to a durable on-disk CAS and recovers on reboot (SRC-14)', async () => {
  const os = await import('node:os');
  const nodePath = await import('node:path');
  const fs = await import('node:fs');
  const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'agy-cas-'));

  try {
    const store = new ArtifactStore({ persistenceDir: tempDir });
    await store.boot();

    const env = await store.put('durable payload', { kind: 'DOC' });
    await store.pin(env.hash);
    await store.shutdown();

    // New instance against the same dir must recover the blob + envelope + pin.
    const store2 = new ArtifactStore({ persistenceDir: tempDir });
    await store2.boot();
    const recovered = await store2.get(env.hash);
    assert.notStrictEqual(recovered, null);
    assert.strictEqual(recovered?.toString('utf-8'), 'durable payload');
    const recoveredEnv = await store2.getEnvelope(env.hash);
    assert.notStrictEqual(recoveredEnv, null);
    assert.strictEqual(recoveredEnv?.size, Buffer.from('durable payload').length);
    await store2.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ArtifactStore durable index uses an append-only journal that compacts (no O(n) rewrite per put)', async () => {
  const os = await import('node:os');
  const nodePath = await import('node:path');
  const fs = await import('node:fs');
  const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'agy-cas-journal-'));

  try {
    // Compact every 5 mutations so compaction triggers within the test.
    const store = new ArtifactStore({ persistenceDir: tempDir, indexSnapshotInterval: 5 });
    await store.boot();

    const N = 50;
    for (let i = 0; i < N; i++) {
      await store.put(`journal-payload-${i}`);
    }
    await store.shutdown();

    const logFile = nodePath.join(tempDir, 'index.log');
    const snapFile = nodePath.join(tempDir, 'index.json');
    assert.strictEqual(fs.existsSync(snapFile), true, 'a snapshot must exist after compaction');
    const logRecords = fs.existsSync(logFile)
      ? fs.readFileSync(logFile, 'utf-8').split('\n').filter((l) => l.trim().length > 0).length
      : 0;
    // After compaction the journal must be far smaller than N records (bounded).
    assert.ok(logRecords < N, `journal should be compacted, got ${logRecords} records (>= ${N})`);

    // Recovery must restore every artifact despite journal compaction.
    const store2 = new ArtifactStore({ persistenceDir: tempDir, indexSnapshotInterval: 5 });
    await store2.boot();
    for (let i = 0; i < N; i++) {
      const expected = `journal-payload-${i}`;
      const hash = (await import('node:crypto')).createHash('sha256').update(expected).digest('hex');
      const buf = await store2.get(hash as any);
      assert.ok(buf, `artifact ${i} must be recovered`);
      assert.strictEqual(buf!.toString('utf-8'), expected);
    }
    await store2.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ArtifactStore streams large blobs to disk without buffering the whole payload (SRC-15)', async () => {
  const os = await import('node:os');
  const nodePath = await import('node:path');
  const fs = await import('node:fs');
  const crypto = await import('node:crypto');
  const streamModule = await import('node:stream');
  const tempDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'agy-cas-stream-'));

  try {
    const store = new ArtifactStore({ persistenceDir: tempDir });
    await store.boot();

    const chunkSize = 64 * 1024;
    const chunks = 64;
    const baseChunk = Buffer.alloc(chunkSize, 0xab);
    const expectedHash = crypto.createHash('sha256');
    let sent = 0;
    const source = new streamModule.Readable({
      read() {
        if (sent < chunks) {
          sent++;
          expectedHash.update(baseChunk);
          this.push(baseChunk);
        } else {
          this.push(null);
        }
      },
    });

    const env = await store.putStream(source, { type: 'BIG' });
    const want = expectedHash.digest('hex');
    assert.strictEqual(env.hash, want, 'streamed hash must match incremental sha256');
    assert.strictEqual(env.size, chunkSize * chunks);

    // getStream must return a real disk stream that yields the same bytes.
    const outStream = await store.getStream(env.hash);
    assert.notStrictEqual(outStream, null);
    const reHash = crypto.createHash('sha256');
    for await (const c of outStream!) {
      reHash.update(c as Buffer);
    }
    assert.strictEqual(reHash.digest('hex'), want);

    await store.shutdown();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
