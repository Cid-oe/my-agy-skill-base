/**
 * Concrete Content-Addressed Artifact Store implementation.
 * Hashes content via SHA-256, provides deduplicated immutable blob storage,
 * reference-counting GC, pinning, and event bus lifecycle notification (RFC-0004).
 *
 * By default the store is in-memory. When constructed with a `persistenceDir`
 * it becomes a durable, content-addressed on-disk store (SRC-14) with real
 * streaming writes (SRC-15). Blobs are stored at
 * `<dir>/cas/<hh>/<hash>` and the envelope index at `<dir>/index.json`.
 */

import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { ArtifactEnvelope, Hash, SubsystemHealth, AgyError, UUID, asUUID, asHash, asSemVer, SemVer } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { GcReport, IArtifactStore } from './interfaces.js';

export interface ArtifactStoreOptions {
  eventBus?: IEventBus;
  /** When set, blobs and the envelope index are persisted to this directory (durable CAS). */
  persistenceDir?: string;
}

export class ArtifactStore implements IArtifactStore {
  public readonly id: UUID = asUUID('artifact-store');
  public readonly name = 'artifact-store';
  private _blobs = new Map<Hash, Buffer>();
  private _envelopes = new Map<Hash, ArtifactEnvelope>();
  private _pinned = new Set<Hash>();
  private _isReady = false;
  private _bootTime = 0;
  private _eventBus?: IEventBus;
  private _persistenceDir?: string;

  constructor(options: ArtifactStoreOptions = {}) {
    this._eventBus = options.eventBus;
    this._persistenceDir = options.persistenceDir;
  }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();
    if (this._persistenceDir) {
      const casDir = path.join(this._persistenceDir, 'cas');
      if (!fs.existsSync(casDir)) {
        fs.mkdirSync(casDir, { recursive: true });
      }
      this.loadIndex();
    }
  }

  public async shutdown(): Promise<void> {
    this._isReady = false;
  }

  // ISubsystem compliance
  public async start(): Promise<void> { return this.boot(); }
  public async stop(): Promise<void> { return this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  public async put(
    content: Buffer | Uint8Array | string,
    metadata: Record<string, unknown> = {},
    createdBy: { id: string; version: string | SemVer } = { id: 'system', version: asSemVer('0.1.0') },
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

    const hash = asHash(createHash('sha256').update(buffer).digest('hex'));

    // Natural deduplication
    if (this._envelopes.has(hash)) {
      const existing = this._envelopes.get(hash)!;
      existing.refCount++;
      this.persistIndex();
      return { ...existing };
    }

    const envelope: ArtifactEnvelope = {
      hash,
      size: buffer.length,
      mimeType,
      createdBy: { id: createdBy.id, version: asSemVer(createdBy.version) },
      refCount: 1,
      createdAt: Date.now(),
      metadata,
    };

    if (this._persistenceDir) {
      this.writeBlob(hash, buffer);
    } else {
      this._blobs.set(hash, buffer);
    }
    this._envelopes.set(hash, envelope);
    this.persistIndex();

    if (this._eventBus) {
      await this._eventBus.publish('artifact.created', {
        id: asUUID(randomUUID()),
        topic: 'artifact.created',
        key: hash,
        payload: { hash, size: envelope.size, mimeType },
        timestamp: Date.now(),
      });
    }

    return { ...envelope };
  }

  public async putStream(
    stream: Readable,
    metadata: Record<string, unknown> = {},
    createdBy: { id: string; version: string | SemVer } = { id: 'system', version: asSemVer('0.1.0') },
    mimeType = 'application/octet-stream'
  ): Promise<ArtifactEnvelope> {
    // Durable mode: stream straight to a temp file with incremental hashing
    // (constant memory regardless of blob size). In-memory mode buffers.
    if (this._persistenceDir) {
      fs.mkdirSync(path.join(this._persistenceDir, 'cas'), { recursive: true });
      const tempFile = path.join(this._persistenceDir, 'cas', `.tmp-${randomUUID()}`);
      const hasher = createHash('sha256');
      const writeStream = createWriteStream(tempFile);
      let size = 0;

      const onData = (chunk: Buffer) => {
        hasher.update(chunk);
        size += chunk.length;
      };
      stream.on('data', onData);

      try {
        stream.pipe(writeStream);
        await new Promise<void>((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
          stream.on('error', reject);
        });
      } finally {
        stream.removeListener('data', onData);
      }

      const hash = asHash(hasher.digest('hex'));

      // Dedup: if the content already exists, discard the temp file.
      if (this._envelopes.has(hash)) {
        fs.rmSync(tempFile, { force: true });
        const existing = this._envelopes.get(hash)!;
        existing.refCount++;
        this.persistIndex();
        return { ...existing };
      }

      const dest = this.casPath(hash);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(tempFile, dest);

      const envelope: ArtifactEnvelope = {
        hash,
        size,
        mimeType,
        createdBy: { id: createdBy.id, version: asSemVer(createdBy.version) },
        refCount: 1,
        createdAt: Date.now(),
        metadata,
      };
      this._envelopes.set(hash, envelope);
      this.persistIndex();
      return { ...envelope };
    }

    // In-memory fallback (small payloads).
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const combined = Buffer.concat(chunks);
    return this.put(combined, metadata, createdBy, mimeType);
  }

  public async get(hash: Hash): Promise<Buffer | null> {
    let buffer: Buffer | null = null;
    if (this._persistenceDir) {
      const p = this.casPath(hash);
      if (fs.existsSync(p)) {
        buffer = fs.readFileSync(p);
      }
    } else {
      buffer = this._blobs.get(hash) ?? null;
    }
    if (!buffer) return null;

    // Verify SHA-256 integrity on read
    const derived = asHash(createHash('sha256').update(buffer).digest('hex'));
    if (derived !== hash) {
      throw new AgyError(`Integrity check failed for artifact ${hash}. Computed ${derived}`, {
        code: 'ARTIFACT_CORRUPTED',
        subsystem: 'artifact',
        retryable: false,
      });
    }

    return Buffer.from(buffer);
  }

  public async getStream(hash: Hash): Promise<Readable | null> {
    if (this._persistenceDir) {
      const p = this.casPath(hash);
      if (!fs.existsSync(p)) return null;
      // True streaming read from disk.
      return createReadStream(p);
    }
    const buffer = await this.get(hash);
    if (!buffer) return null;
    return Readable.from(buffer);
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
    this.persistIndex();
  }

  public async unpin(hash: Hash): Promise<void> {
    this._pinned.delete(hash);
    this.persistIndex();
  }

  public async incrementRefCount(hash: Hash): Promise<number> {
    const envelope = this._envelopes.get(hash);
    if (!envelope) return 0;
    envelope.refCount++;
    this.persistIndex();
    return envelope.refCount;
  }

  public async decrementRefCount(hash: Hash): Promise<number> {
    const envelope = this._envelopes.get(hash);
    if (!envelope) return 0;
    if (envelope.refCount > 0) {
      envelope.refCount--;
    }
    this.persistIndex();
    return envelope.refCount;
  }

  public async gc(): Promise<GcReport> {
    let reclaimedBytes = 0;
    let deletedCount = 0;

    for (const [hash, envelope] of Array.from(this._envelopes.entries())) {
      if (envelope.refCount <= 0 && !this._pinned.has(hash)) {
        reclaimedBytes += envelope.size;
        deletedCount++;
        if (this._persistenceDir) {
          fs.rmSync(this.casPath(hash), { force: true });
        } else {
          this._blobs.delete(hash);
        }
        this._envelopes.delete(hash);
      }
    }

    this.persistIndex();
    return { reclaimedBytes, deletedCount };
  }

  public async flush(): Promise<void> {
    // Memory backend settles immediately; disk backend writes synchronously.
  }

  // --- durable CAS helpers ---

  private casPath(hash: Hash): string {
    return path.join(this._persistenceDir!, 'cas', hash.slice(0, 2), hash);
  }

  private indexPath(): string {
    return path.join(this._persistenceDir!, 'index.json');
  }

  private writeBlob(hash: Hash, buffer: Buffer): void {
    const dest = this.casPath(hash);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, buffer);
    }
  }

  private persistIndex(): void {
    if (!this._persistenceDir) return;
    const envelopes: Record<string, ArtifactEnvelope> = {};
    for (const [k, v] of this._envelopes.entries()) {
      envelopes[k] = { ...v };
    }
    const payload = JSON.stringify({
      envelopes,
      pinned: Array.from(this._pinned),
    });
    const tmp = `${this.indexPath()}.tmp`;
    fs.writeFileSync(tmp, payload);
    fs.renameSync(tmp, this.indexPath());
  }

  private loadIndex(): void {
    const idx = this.indexPath();
    if (!fs.existsSync(idx)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(idx, 'utf-8')) as {
        envelopes: Record<string, ArtifactEnvelope>;
        pinned?: string[];
      };
      for (const [k, v] of Object.entries(raw.envelopes)) {
        // Only restore envelopes whose blob still exists on disk.
        if (fs.existsSync(this.casPath(asHash(k)))) {
          this._envelopes.set(asHash(k), { ...v });
        }
      }
      for (const h of raw.pinned ?? []) {
        this._pinned.add(asHash(h));
      }
    } catch {
      // Corrupt index: start empty; blobs remain on disk for manual recovery.
    }
  }
}
