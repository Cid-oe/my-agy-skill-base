/**
 * Content-addressed artifact store with optional durable CAS persistence.
 * All externally visible data is cloned, hashes are validated, and durable
 * writes use temporary files plus fsync/rename before becoming visible.
 */

import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ArtifactEnvelope, Hash, SubsystemHealth, AgyError, UUID, asUUID, asHash, asSemVer, SemVer, deepClone } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { GcReport, IArtifactStore } from './interfaces.js';

const LEGACY_HOLDER = '__legacy__';

export interface ArtifactStoreOptions {
  eventBus?: IEventBus;
  /** When set, blobs and the envelope index are persisted to this directory. */
  persistenceDir?: string;
  /** Compact the index journal every N mutations (default 200). */
  indexSnapshotInterval?: number;
}

export class ArtifactStore implements IArtifactStore {
  public readonly id: UUID = asUUID('artifact-store');
  public readonly name = 'artifact-store';
  private _blobs = new Map<Hash, Buffer>();
  private _envelopes = new Map<Hash, ArtifactEnvelope>();
  private _pinned = new Map<Hash, Set<string>>();
  private _isReady = false;
  private _bootTime = 0;
  private _eventBus?: IEventBus;
  private _persistenceDir?: string;
  private _mutationsSinceSnapshot = 0;
  private readonly _indexSnapshotInterval: number;

  constructor(options: ArtifactStoreOptions = {}) {
    this._eventBus = options.eventBus;
    this._persistenceDir = options.persistenceDir;
    this._indexSnapshotInterval = validatePositiveInteger(options.indexSnapshotInterval ?? 200, 'indexSnapshotInterval');
  }

  public async boot(): Promise<void> {
    if (this._isReady) return;
    this._isReady = true;
    this._bootTime = Date.now();
    if (this._persistenceDir) {
      fs.mkdirSync(path.join(this._persistenceDir, 'cas'), { recursive: true });
      this.loadIndex();
    }
  }

  public async shutdown(): Promise<void> {
    if (!this._isReady) return;
    if (this._persistenceDir) this.snapshotIndex();
    this._isReady = false;
  }

  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }

  public health(): SubsystemHealth {
    return { status: this._isReady ? 'healthy' : 'unhealthy', uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0 };
  }

  public async put(
    content: Buffer | Uint8Array | string,
    metadata: Record<string, unknown> = {},
    createdBy: { id: string; version: string | SemVer } = { id: 'system', version: asSemVer('0.1.0') },
    mimeType = 'application/octet-stream'
  ): Promise<ArtifactEnvelope> {
    this.assertReady();
    const buffer = Buffer.isBuffer(content)
      ? Buffer.from(content)
      : typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);
    const hash = asHash(createHash('sha256').update(buffer).digest('hex'));

    const existing = this._envelopes.get(hash);
    if (existing) {
      existing.refCount++;
      this.journal({ op: 'env', env: deepClone(existing) });
      return deepClone(existing);
    }

    const envelope: ArtifactEnvelope = {
      hash,
      size: buffer.length,
      mimeType,
      createdBy: { id: createdBy.id, version: asSemVer(createdBy.version) },
      refCount: 1,
      createdAt: Date.now(),
      metadata: deepClone(metadata),
    };

    if (this._persistenceDir) this.writeBlob(hash, buffer);
    else this._blobs.set(hash, Buffer.from(buffer));
    this._envelopes.set(hash, envelope);
    this.journal({ op: 'env', env: deepClone(envelope) });
    await this.publishEvent('artifact.created', hash, { hash, size: envelope.size, mimeType });
    return deepClone(envelope);
  }

  public async putStream(
    stream: Readable,
    metadata: Record<string, unknown> = {},
    createdBy: { id: string; version: string | SemVer } = { id: 'system', version: asSemVer('0.1.0') },
    mimeType = 'application/octet-stream'
  ): Promise<ArtifactEnvelope> {
    this.assertReady();

    if (this._persistenceDir) {
      fs.mkdirSync(path.join(this._persistenceDir, 'cas'), { recursive: true });
      const tempFile = path.join(this._persistenceDir, 'cas', `.tmp-${randomUUID()}`);
      let size = 0;
      const hasher = createHash('sha256');
      const tee = new Transform({
        transform: (chunk: Buffer, _encoding, callback) => {
          hasher.update(chunk);
          size += chunk.length;
          callback(null, chunk);
        },
      });
      try {
        await pipeline(stream, tee, createWriteStream(tempFile));
        this.fsyncFile(tempFile);
        const hash = asHash(hasher.digest('hex'));
        const existing = this._envelopes.get(hash);
        if (existing) {
          fs.rmSync(tempFile, { force: true });
          existing.refCount++;
          this.journal({ op: 'env', env: deepClone(existing) });
          return deepClone(existing);
        }

        const dest = this.casPath(hash);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (fs.existsSync(dest)) fs.rmSync(tempFile, { force: true });
        else fs.renameSync(tempFile, dest);

        const envelope: ArtifactEnvelope = {
          hash,
          size,
          mimeType,
          createdBy: { id: createdBy.id, version: asSemVer(createdBy.version) },
          refCount: 1,
          createdAt: Date.now(),
          metadata: deepClone(metadata),
        };
        this._envelopes.set(hash, envelope);
        this.journal({ op: 'env', env: deepClone(envelope) });
        await this.publishEvent('artifact.created', hash, { hash, size, mimeType });
        return deepClone(envelope);
      } catch (err) {
        fs.rmSync(tempFile, { force: true });
        throw err;
      }
    }

    const chunks: Buffer[] = [];
    try {
      for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk));
    } catch (err) {
      stream.destroy();
      throw err;
    }
    return this.put(Buffer.concat(chunks), metadata, createdBy, mimeType);
  }

  public async get(hash: Hash): Promise<Buffer | null> {
    this.assertReady();
    this.assertValidHash(hash);
    let buffer: Buffer | null = null;
    if (this._persistenceDir) {
      const p = this.casPath(hash);
      if (fs.existsSync(p)) buffer = fs.readFileSync(p);
    } else buffer = this._blobs.get(hash) ?? null;
    if (!buffer) return null;
    this.verifyHash(hash, buffer);
    return Buffer.from(buffer);
  }

  public async getStream(hash: Hash): Promise<Readable | null> {
    this.assertReady();
    this.assertValidHash(hash);
    if (!this._persistenceDir) {
      const buffer = await this.get(hash);
      return buffer ? Readable.from(buffer) : null;
    }

    const p = this.casPath(hash);
    if (!fs.existsSync(p)) return null;
    // Verify the complete file before exposing a readable stream. This is a
    // second sequential read in durable mode, but it guarantees consumers can
    // never process corrupted bytes before the integrity error is known.
    const hasher = createHash('sha256');
    for await (const chunk of createReadStream(p)) hasher.update(chunk as Buffer);
    const computed = hasher.digest('hex');
    if (computed !== hash) throw new AgyError(`Integrity check failed for artifact ${hash}. Computed ${computed}`, {
      code: 'ARTIFACT_CORRUPTED', subsystem: 'artifact', retryable: false,
    });
    return createReadStream(p);
  }

  public async getEnvelope(hash: Hash): Promise<ArtifactEnvelope | null> {
    this.assertReady();
    this.assertValidHash(hash);
    const envelope = this._envelopes.get(hash);
    return envelope ? deepClone(envelope) : null;
  }

  public async pin(hash: Hash, holderId = LEGACY_HOLDER): Promise<void> {
    this.assertReady();
    this.assertValidHash(hash);
    if (!this._envelopes.has(hash)) {
      throw new AgyError(`Cannot pin non-existent artifact ${hash}`, {
        code: 'ARTIFACT_NOT_FOUND', subsystem: 'artifact', retryable: false,
      });
    }
    if (!holderId) throw new TypeError('holderId is required');
    let holders = this._pinned.get(hash);
    if (!holders) { holders = new Set<string>(); this._pinned.set(hash, holders); }
    holders.add(holderId);
    this.journal({ op: 'pin', hash, holderId });
  }

  public async unpin(hash: Hash, holderId = LEGACY_HOLDER): Promise<void> {
    this.assertReady();
    this.assertValidHash(hash);
    const holders = this._pinned.get(hash);
    if (holders) {
      holders.delete(holderId);
      if (holders.size === 0) this._pinned.delete(hash);
    }
    this.journal({ op: 'unpin', hash, holderId });
  }

  public async incrementRefCount(hash: Hash): Promise<number> {
    this.assertReady();
    this.assertValidHash(hash);
    const envelope = this._envelopes.get(hash);
    if (!envelope) return 0;
    envelope.refCount++;
    this.journal({ op: 'env', env: deepClone(envelope) });
    return envelope.refCount;
  }

  public async decrementRefCount(hash: Hash): Promise<number> {
    this.assertReady();
    this.assertValidHash(hash);
    const envelope = this._envelopes.get(hash);
    if (!envelope) return 0;
    if (envelope.refCount > 0) envelope.refCount--;
    this.journal({ op: 'env', env: deepClone(envelope) });
    return envelope.refCount;
  }

  public async gc(): Promise<GcReport> {
    this.assertReady();
    let reclaimedBytes = 0;
    let deletedCount = 0;
    for (const [hash, envelope] of Array.from(this._envelopes.entries())) {
      const holders = this._pinned.get(hash);
      if (envelope.refCount <= 0 && (!holders || holders.size === 0)) {
        reclaimedBytes += envelope.size;
        deletedCount++;
        if (this._persistenceDir) fs.rmSync(this.casPath(hash), { force: true });
        else this._blobs.delete(hash);
        this._envelopes.delete(hash);
        this._pinned.delete(hash);
        this.journal({ op: 'del', hash });
      }
    }
    return { reclaimedBytes, deletedCount };
  }

  public async flush(): Promise<void> {
    if (this._persistenceDir && this._isReady) this.snapshotIndex();
  }

  private assertReady(): void {
    if (!this._isReady) throw new AgyError('ArtifactStore is not ready', {
      code: 'STORE_NOT_READY', subsystem: 'artifact', retryable: false,
    });
  }

  private assertValidHash(hash: Hash): void {
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) {
      throw new AgyError(`Invalid artifact hash: ${String(hash)}`, {
        code: 'ARTIFACT_HASH_INVALID', subsystem: 'artifact', retryable: false,
      });
    }
  }

  private verifyHash(hash: Hash, buffer: Buffer): void {
    const computed = createHash('sha256').update(buffer).digest('hex');
    if (computed !== hash) {
      throw new AgyError(`Integrity check failed for artifact ${hash}. Computed ${computed}`, {
        code: 'ARTIFACT_CORRUPTED', subsystem: 'artifact', retryable: false,
      });
    }
  }

  private async publishEvent(topic: string, hash: Hash, payload: Record<string, unknown>): Promise<void> {
    if (!this._eventBus) return;
    try {
      await this._eventBus.publish(topic, {
        id: asUUID(randomUUID()), topic, key: hash, payload, timestamp: Date.now(),
      });
    } catch (err) {
      console.error('[ArtifactStore] Event publication failed after commit:', err);
    }
  }

  private casPath(hash: Hash): string {
    this.assertValidHash(hash);
    return path.join(this._persistenceDir!, 'cas', hash.slice(0, 2), hash);
  }

  private indexPath(): string { return path.join(this._persistenceDir!, 'index.json'); }

  private writeBlob(hash: Hash, buffer: Buffer): void {
    const dest = this.casPath(hash);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) return;
    const temp = `${dest}.tmp-${randomUUID()}`;
    fs.writeFileSync(temp, buffer, { flag: 'wx' });
    this.fsyncFile(temp);
    if (fs.existsSync(dest)) fs.rmSync(temp, { force: true });
    else { fs.renameSync(temp, dest); this.fsyncDirectory(path.dirname(dest)); }
  }

  private fsyncFile(file: string): void {
    const fd = fs.openSync(file, 'r+');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }

  private journal(record: object): void {
    if (!this._persistenceDir) return;
    const logFile = path.join(this._persistenceDir, 'index.log');
    fs.mkdirSync(this._persistenceDir, { recursive: true });
    const fd = fs.openSync(logFile, 'a');
    try { fs.writeSync(fd, JSON.stringify(record) + '\n'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    this._mutationsSinceSnapshot++;
    if (this._mutationsSinceSnapshot >= this._indexSnapshotInterval) this.snapshotIndex();
  }

  private snapshotIndex(): void {
    if (!this._persistenceDir) return;
    fs.mkdirSync(this._persistenceDir, { recursive: true });
    const envelopes: Record<string, ArtifactEnvelope> = {};
    for (const [k, v] of this._envelopes.entries()) envelopes[k] = deepClone(v);
    const pinned: Array<{ hash: string; holders: string[] }> = [];
    for (const [hash, holders] of this._pinned.entries()) pinned.push({ hash, holders: [...holders] });
    const tmp = `${this.indexPath()}.tmp-${randomUUID()}`;
    fs.writeFileSync(tmp, JSON.stringify({ envelopes, pinned }));
    this.fsyncFile(tmp);
    fs.renameSync(tmp, this.indexPath());
    this.fsyncDirectory(this._persistenceDir);
    const logFile = path.join(this._persistenceDir, 'index.log');
    const fd = fs.openSync(logFile, 'w');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    this._mutationsSinceSnapshot = 0;
  }

  private loadIndex(): void {
    this._envelopes.clear();
    this._pinned.clear();
    const idx = this.indexPath();
    if (fs.existsSync(idx)) {
      try {
        const raw = JSON.parse(fs.readFileSync(idx, 'utf8')) as {
          envelopes?: Record<string, ArtifactEnvelope>;
          pinned?: Array<{ hash: string; holders?: string[] }> | string[];
        };
        for (const [k, v] of Object.entries(raw.envelopes ?? {})) {
          if (/^[a-f0-9]{64}$/.test(k) && fs.existsSync(this.casPath(asHash(k)))) {
            this._envelopes.set(asHash(k), deepClone(v));
          }
        }
        for (const entry of raw.pinned ?? []) {
          if (typeof entry === 'string') this.addPin(asHash(entry), LEGACY_HOLDER);
          else for (const holder of entry.holders ?? []) this.addPin(asHash(entry.hash), holder);
        }
      } catch {
        // Replay any surviving journal below.
      }
    }

    const logFile = path.join(this._persistenceDir!, 'index.log');
    if (!fs.existsSync(logFile)) return;
    const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines) {
      try {
        const rec = JSON.parse(line) as { op: string; hash?: string; holderId?: string; env?: ArtifactEnvelope };
        if (rec.op === 'env' && rec.env && /^[a-f0-9]{64}$/.test(rec.env.hash) && fs.existsSync(this.casPath(asHash(rec.env.hash)))) {
          this._envelopes.set(asHash(rec.env.hash), deepClone(rec.env));
        } else if (rec.op === 'pin' && rec.hash && /^[a-f0-9]{64}$/.test(rec.hash)) {
          this.addPin(asHash(rec.hash), rec.holderId ?? LEGACY_HOLDER);
        } else if (rec.op === 'unpin' && rec.hash && /^[a-f0-9]{64}$/.test(rec.hash)) {
          const holders = this._pinned.get(asHash(rec.hash));
          holders?.delete(rec.holderId ?? LEGACY_HOLDER);
          if (holders?.size === 0) this._pinned.delete(asHash(rec.hash));
        } else if (rec.op === 'del' && rec.hash && /^[a-f0-9]{64}$/.test(rec.hash)) {
          this._envelopes.delete(asHash(rec.hash));
          this._pinned.delete(asHash(rec.hash));
        }
      } catch {
        // Ignore malformed trailing journal records.
      }
    }
  }

  private fsyncDirectory(directory: string): void {
    try {
      const fd = fs.openSync(directory, 'r');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    } catch {
      // Some filesystems/platforms do not permit directory fsync; the file
      // contents were already fsynced and the operation remains best-effort.
    }
  }

  private addPin(hash: Hash, holderId: string): void {
    if (!/^[a-f0-9]{64}$/.test(hash)) return;
    let holders = this._pinned.get(hash);
    if (!holders) { holders = new Set<string>(); this._pinned.set(hash, holders); }
    holders.add(holderId);
  }
}

function validatePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
  return value;
}
