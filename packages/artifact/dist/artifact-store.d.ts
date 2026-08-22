/**
 * Concrete Content-Addressed Artifact Store implementation.
 * Hashes content via SHA-256, provides deduplicated immutable blob storage,
 * reference-counting GC, pinning, and event bus lifecycle notification (RFC-0004).
 */
import { Readable } from 'node:stream';
import { ArtifactEnvelope, Hash, SubsystemHealth, UUID, SemVer } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { GcReport, IArtifactStore } from './interfaces.js';
export interface ArtifactStoreOptions {
    eventBus?: IEventBus;
}
export declare class ArtifactStore implements IArtifactStore {
    readonly id: UUID;
    readonly name = "artifact-store";
    private _blobs;
    private _envelopes;
    private _pinned;
    private _isReady;
    private _bootTime;
    private _eventBus?;
    constructor(options?: ArtifactStoreOptions);
    boot(): Promise<void>;
    shutdown(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    getHealth(): Promise<SubsystemHealth>;
    health(): SubsystemHealth;
    put(content: Buffer | Uint8Array | string, metadata?: Record<string, unknown>, createdBy?: {
        id: string;
        version: string | SemVer;
    }, mimeType?: string): Promise<ArtifactEnvelope>;
    putStream(stream: Readable, metadata?: Record<string, unknown>, createdBy?: {
        id: string;
        version: string | SemVer;
    }, mimeType?: string): Promise<ArtifactEnvelope>;
    get(hash: Hash): Promise<Buffer | null>;
    getStream(hash: Hash): Promise<Readable | null>;
    getEnvelope(hash: Hash): Promise<ArtifactEnvelope | null>;
    pin(hash: Hash): Promise<void>;
    unpin(hash: Hash): Promise<void>;
    incrementRefCount(hash: Hash): Promise<number>;
    decrementRefCount(hash: Hash): Promise<number>;
    gc(): Promise<GcReport>;
    flush(): Promise<void>;
}
//# sourceMappingURL=artifact-store.d.ts.map