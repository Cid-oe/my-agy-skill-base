"use strict";
/**
 * Concrete Content-Addressed Artifact Store implementation.
 * Hashes content via SHA-256, provides deduplicated immutable blob storage,
 * reference-counting GC, pinning, and event bus lifecycle notification (RFC-0004).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactStore = void 0;
const node_crypto_1 = require("node:crypto");
const node_stream_1 = require("node:stream");
const shared_1 = require("@agy/shared");
class ArtifactStore {
    id = (0, shared_1.asUUID)('artifact-store');
    name = 'artifact-store';
    _blobs = new Map();
    _envelopes = new Map();
    _pinned = new Set();
    _isReady = false;
    _bootTime = 0;
    _eventBus;
    constructor(options = {}) {
        this._eventBus = options.eventBus;
    }
    async boot() {
        this._isReady = true;
        this._bootTime = Date.now();
    }
    async shutdown() {
        this._isReady = false;
    }
    // ISubsystem compliance
    async start() { return this.boot(); }
    async stop() { return this.shutdown(); }
    async getHealth() { return Promise.resolve(this.health()); }
    health() {
        return {
            status: this._isReady ? 'healthy' : 'unhealthy',
            uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
        };
    }
    async put(content, metadata = {}, createdBy = { id: 'system', version: (0, shared_1.asSemVer)('0.1.0') }, mimeType = 'application/octet-stream') {
        if (!this._isReady) {
            throw new shared_1.AgyError('ArtifactStore is not ready', {
                code: 'STORE_NOT_READY',
                subsystem: 'artifact',
                retryable: false,
            });
        }
        const buffer = Buffer.isBuffer(content)
            ? content
            : typeof content === 'string'
                ? Buffer.from(content, 'utf-8')
                : Buffer.from(content);
        const hash = (0, shared_1.asHash)((0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex'));
        // Natural deduplication
        if (this._envelopes.has(hash)) {
            const existing = this._envelopes.get(hash);
            existing.refCount++;
            return { ...existing };
        }
        const envelope = {
            hash,
            size: buffer.length,
            mimeType,
            createdBy: { id: createdBy.id, version: (0, shared_1.asSemVer)(createdBy.version) },
            refCount: 1,
            createdAt: Date.now(),
            metadata,
        };
        this._blobs.set(hash, buffer);
        this._envelopes.set(hash, envelope);
        if (this._eventBus) {
            await this._eventBus.publish('artifact.created', {
                id: (0, shared_1.asUUID)((0, node_crypto_1.randomUUID)()),
                topic: 'artifact.created',
                key: hash,
                payload: { hash, size: envelope.size, mimeType },
                timestamp: Date.now(),
            });
        }
        return { ...envelope };
    }
    async putStream(stream, metadata = {}, createdBy = { id: 'system', version: (0, shared_1.asSemVer)('0.1.0') }, mimeType = 'application/octet-stream') {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const combined = Buffer.concat(chunks);
        return this.put(combined, metadata, createdBy, mimeType);
    }
    async get(hash) {
        const buffer = this._blobs.get(hash);
        if (!buffer)
            return null;
        // Verify SHA-256 integrity on read
        const derived = (0, shared_1.asHash)((0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex'));
        if (derived !== hash) {
            throw new shared_1.AgyError(`Integrity check failed for artifact ${hash}. Computed ${derived}`, {
                code: 'ARTIFACT_CORRUPTED',
                subsystem: 'artifact',
                retryable: false,
            });
        }
        return Buffer.from(buffer);
    }
    async getStream(hash) {
        const buffer = await this.get(hash);
        if (!buffer)
            return null;
        return node_stream_1.Readable.from(buffer);
    }
    async getEnvelope(hash) {
        const envelope = this._envelopes.get(hash);
        return envelope ? { ...envelope } : null;
    }
    async pin(hash) {
        if (!this._envelopes.has(hash)) {
            throw new shared_1.AgyError(`Cannot pin non-existent artifact ${hash}`, {
                code: 'ARTIFACT_NOT_FOUND',
                subsystem: 'artifact',
                retryable: false,
            });
        }
        this._pinned.add(hash);
    }
    async unpin(hash) {
        this._pinned.delete(hash);
    }
    async incrementRefCount(hash) {
        const envelope = this._envelopes.get(hash);
        if (!envelope)
            return 0;
        envelope.refCount++;
        return envelope.refCount;
    }
    async decrementRefCount(hash) {
        const envelope = this._envelopes.get(hash);
        if (!envelope)
            return 0;
        if (envelope.refCount > 0) {
            envelope.refCount--;
        }
        return envelope.refCount;
    }
    async gc() {
        let reclaimedBytes = 0;
        let deletedCount = 0;
        for (const [hash, envelope] of Array.from(this._envelopes.entries())) {
            if (envelope.refCount <= 0 && !this._pinned.has(hash)) {
                reclaimedBytes += envelope.size;
                deletedCount++;
                this._blobs.delete(hash);
                this._envelopes.delete(hash);
            }
        }
        return { reclaimedBytes, deletedCount };
    }
    async flush() {
        // Memory backend settles immediately
    }
}
exports.ArtifactStore = ArtifactStore;
//# sourceMappingURL=artifact-store.js.map