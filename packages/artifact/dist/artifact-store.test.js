"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const artifact_store_js_1 = require("./artifact-store.js");
const event_bus_1 = require("@agy/event-bus");
(0, node_test_1.test)('ArtifactStore puts content and computes deterministic SHA-256 hash', async () => {
    const bus = new event_bus_1.EventBus();
    await bus.boot();
    const store = new artifact_store_js_1.ArtifactStore({ eventBus: bus });
    await store.boot();
    const content = 'Deterministic Artifact Payload';
    const envelope = await store.put(content, { type: 'PRD' });
    node_assert_1.default.strictEqual(typeof envelope.hash, 'string');
    node_assert_1.default.strictEqual(envelope.hash.length, 64);
    node_assert_1.default.strictEqual(envelope.size, Buffer.from(content).length);
    // Retrieve content
    const retrieved = await store.get(envelope.hash);
    node_assert_1.default.notStrictEqual(retrieved, null);
    node_assert_1.default.strictEqual(retrieved?.toString('utf-8'), content);
    await store.shutdown();
    await bus.shutdown();
});
(0, node_test_1.test)('ArtifactStore deduplicates identical content and manages ref counts', async () => {
    const store = new artifact_store_js_1.ArtifactStore();
    await store.boot();
    const env1 = await store.put('Shared Text Payload');
    const env2 = await store.put('Shared Text Payload');
    node_assert_1.default.strictEqual(env1.hash, env2.hash);
    node_assert_1.default.strictEqual(env2.refCount, 2);
    // Decrement
    await store.decrementRefCount(env1.hash);
    await store.decrementRefCount(env1.hash);
    // GC cleans up 0 refCount artifacts
    const gcReport = await store.gc();
    node_assert_1.default.strictEqual(gcReport.deletedCount, 1);
    const missing = await store.get(env1.hash);
    node_assert_1.default.strictEqual(missing, null);
    await store.shutdown();
});
(0, node_test_1.test)('ArtifactStore respects pinned artifacts during GC', async () => {
    const store = new artifact_store_js_1.ArtifactStore();
    await store.boot();
    const env = await store.put('Pinned Content');
    await store.pin(env.hash);
    await store.decrementRefCount(env.hash); // refCount = 0, but pinned
    const report = await store.gc();
    node_assert_1.default.strictEqual(report.deletedCount, 0);
    const stillThere = await store.get(env.hash);
    node_assert_1.default.notStrictEqual(stillThere, null);
    // Unpin and re-run GC
    await store.unpin(env.hash);
    const unpinnedReport = await store.gc();
    node_assert_1.default.strictEqual(unpinnedReport.deletedCount, 1);
    node_assert_1.default.strictEqual(await store.get(env.hash), null);
    await store.shutdown();
});
(0, node_test_1.test)('ArtifactStore supports streaming reads and writes', async () => {
    const store = new artifact_store_js_1.ArtifactStore();
    await store.boot();
    const streamContent = 'Streaming large artifact content payload';
    const { Readable } = await import('node:stream');
    const readStream = Readable.from(Buffer.from(streamContent));
    const envelope = await store.putStream(readStream, { type: 'STREAM_TEST' });
    node_assert_1.default.strictEqual(envelope.size, Buffer.from(streamContent).length);
    const outStream = await store.getStream(envelope.hash);
    node_assert_1.default.notStrictEqual(outStream, null);
    const chunks = [];
    for await (const chunk of outStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const result = Buffer.concat(chunks).toString('utf-8');
    node_assert_1.default.strictEqual(result, streamContent);
    await store.shutdown();
});
(0, node_test_1.test)('ArtifactStore validates SHA-256 integrity on read and rejects corrupted blobs', async () => {
    const store = new artifact_store_js_1.ArtifactStore();
    await store.boot();
    const envelope = await store.put('Original Content');
    // Intentionally mutate internal blob storage
    const corruptedBuffer = Buffer.from('Tampered Content');
    store._blobs.set(envelope.hash, corruptedBuffer);
    await node_assert_1.default.rejects(async () => {
        await store.get(envelope.hash);
    }, (err) => {
        return err.code === 'ARTIFACT_CORRUPTED';
    });
    await store.shutdown();
});
//# sourceMappingURL=artifact-store.test.js.map