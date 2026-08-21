/**
 * Concrete Content-Addressed Artifact Store implementation.
 * Hashes content via SHA-256, provides deduplicated immutable blob storage,
 * reference-counting GC, pinning, and event bus lifecycle notification (RFC-0004).
 */

import { createHash, randomUUID } from 'node:crypto';
import { ArtifactEnvelope, Hash, SubsystemHealth, AgyError } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { GcReport, IArtifactStore } from './interfaces.js';

export interface ArtifactStoreOptions {
  eventBus?: IEventBus;
}

export class ArtifactStore implements IArtifactStore {
  public readonly name = 'artifact-store';
  private _blobs = new Map<Hash, Buffer>();
  private _envelopes = new Map<Hash, ArtifactEnvelope>();
  private _pinned = new Set<Hash>();
  private _isReady = false;
  private _bootTime = 0;
  private _eventBus?: IEventBus;

  constructor(options: ArtifactStoreOptions = {}) {
    this._eventBus = options.eventBus;
  }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    this._isReady = false;
  }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  public async put(
    content: Buffer | Uint8Array | string,
    metadata: Record<string, unknown> = {},
    createdBy: { id: string; version: string } = { id: 'system', version: '0.1.0' },
    mimeType = 'application/octet-stream'
  ): Promise<ArtifactEnvelope> {
    if (!this._isReady) {
      throw new AgyError('ArtifactStore is not ready', {
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

    const hash = createHash('sha256').update(buffer).digest('hex');

    // Natural deduplication
    if (this._envelopes.has(hash)) {
      const existing = this._envelopes.get(hash)!;
      existing.refCount++;
      return { ...existing };
    }

    const envelope: ArtifactEnvelope = {
      hash,
      size: buffer.length,
      mimeType,
      createdBy,
      refCount: 1,
      createdAt: Date.now(),
      metadata,
    };

    this._blobs.set(hash, buffer);
    this._envelopes.set(hash, envelope);

    if (this._eventBus) {
      await this._eventBus.publish('artifact.created', {
        id: randomUUID(),
        topic: 'artifact.created',
        key: hash,
        payload: { hash, size: envelope.size, mimeType },
        timestamp: Date.now(),
      });
    }

    return { ...envelope };
  }

  public async get(hash: Hash): Promise<Buffer | null> {
    const buffer = this._blobs.get(hash);
    return buffer ? Buffer.from(buffer) : null;
  }

  public async getEnvelope(hash: Hash): Promise<ArtifactEnvelope | null> {
    const envelope = this._envelopes.get(hash);
    return envelope ? { ...envelope } : null;
  }

  public async pin(hash: Hash): Promise<void> {
    if (!this._envelopes.has(hash)) {
      throw new AgyError(`Cannot pin non-existent artifact ${hash}`, {
        code: 'ARTIFACT_NOT_FOUND',
        subsystem: 'artifact',
        retryable: false,
      });
    }
    this._pinned.add(hash);
  }

  public async unpin(hash: Hash): Promise<void> {
    this._pinned.delete(hash);
  }

  public async incrementRefCount(hash: Hash): Promise<number> {
    const envelope = this._envelopes.get(hash);
    if (!envelope) return 0;
    envelope.refCount++;
    return envelope.refCount;
  }

  public async decrementRefCount(hash: Hash): Promise<number> {
    const envelope = this._envelopes.get(hash);
    if (!envelope) return 0;
    if (envelope.refCount > 0) {
      envelope.refCount--;
    }
    return envelope.refCount;
  }

  public async gc(): Promise<GcReport> {
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

  public async flush(): Promise<void> {
    // Memory backend settles immediately
  }
}
