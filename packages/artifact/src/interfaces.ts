/**
 * Artifact System interfaces and contracts.
 * Strictly implements Phase 3 (IArtifactStore) and RFC-0004.
 */

import { Readable } from 'node:stream';
import { ArtifactEnvelope, Hash, SubsystemHealth } from '@agy/shared';
import { ISubsystem } from '@agy/shared';

export interface GcReport {
  reclaimedBytes: number;
  deletedCount: number;
}

export interface IArtifactStore extends ISubsystem {
  put(
    content: Buffer | Uint8Array | string,
    metadata?: Record<string, unknown>,
    createdBy?: { id: string; version: string },
    mimeType?: string
  ): Promise<ArtifactEnvelope>;
  putStream(
    stream: Readable,
    metadata?: Record<string, unknown>,
    createdBy?: { id: string; version: string },
    mimeType?: string
  ): Promise<ArtifactEnvelope>;
  get(hash: Hash): Promise<Buffer | null>;
  getStream(hash: Hash): Promise<Readable | null>;
  getEnvelope(hash: Hash): Promise<ArtifactEnvelope | null>;
  pin(hash: Hash, holderId?: string): Promise<void>;
  unpin(hash: Hash, holderId?: string): Promise<void>;
  incrementRefCount(hash: Hash): Promise<number>;
  decrementRefCount(hash: Hash): Promise<number>;
  gc(): Promise<GcReport>;
  flush(): Promise<void>;
  health(): Promise<SubsystemHealth> | SubsystemHealth;
}
