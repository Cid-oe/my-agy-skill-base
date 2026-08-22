/**
 * Concrete Skill Registry implementation.
 * Stores validated manifests, maintains inverted capability and produces indices,
 * manages quarantining, and integrates with the Event Bus (RFC-0002).
 */

import { randomUUID } from 'node:crypto';
import { SkillHandle, SkillManifest, SubsystemHealth, AgyError, UUID, asUUID } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { ISkillRegistry, QuarantineRecord } from './interfaces.js';
import { validateManifest } from './manifest-validator.js';

export interface SkillRegistryOptions {
  eventBus?: IEventBus;
  /** Optional override path to the manifest JSON schema (defaults to <cwd>/schemas/skill-manifest.json). */
  schemaPath?: string;
}

export class SkillRegistry implements ISkillRegistry {
  public readonly id: UUID = asUUID('skill-registry');

  public async start(): Promise<void> { await this.boot(); }

  public async stop(): Promise<void> { await this.shutdown(); }

  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }
  public readonly name = 'skill-registry';
  private _manifests = new Map<string, Map<string, SkillManifest>>(); // id -> version -> manifest
  private _activeVersions = new Map<string, string>(); // id -> version
  private _byProduces = new Map<string, Set<string>>(); // artifact -> Set<id>
  private _byCapability = new Map<string, Set<string>>(); // capability -> Set<id>
  private _quarantine: QuarantineRecord[] = [];
  private _isReady = false;
  private _bootTime = 0;
  private _eventBus?: IEventBus;
  private _schemaPath?: string;

  constructor(options: SkillRegistryOptions = {}) {
    this._eventBus = options.eventBus;
    this._schemaPath = options.schemaPath;
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

  public async register(manifest: SkillManifest, sourceRoot = 'project'): Promise<SkillHandle> {
    if (!this._isReady) {
      throw new AgyError('SkillRegistry is not ready', {
        code: 'REGISTRY_NOT_READY',
        subsystem: 'registry',
        retryable: false,
      });
    }

    // Validate against the canonical manifest schema (SRC-16).
    const issues = validateManifest(manifest, this._schemaPath);
    const missingIdentity = !manifest.id || !manifest.version || !manifest.name;
    if (missingIdentity || issues.length > 0) {
      const errors = missingIdentity
        ? ['id, version, and name are required']
        : issues.map((i) => `${i.path}: ${i.message}`);
      this._quarantine.push({
        path: sourceRoot,
        reason: missingIdentity
          ? 'Malformed manifest: Missing required identity fields'
          : 'Manifest failed schema validation',
        errors,
        timestamp: Date.now(),
      });
      throw new AgyError(`Invalid manifest for ${manifest.id || 'unknown'}`, {
        code: 'MANIFEST_INVALID',
        subsystem: 'registry',
        retryable: false,
        details: { errors },
      });
    }

    let versionMap = this._manifests.get(manifest.id);
    if (!versionMap) {
      versionMap = new Map();
      this._manifests.set(manifest.id, versionMap);
    }
    versionMap.set(manifest.version, { ...manifest });
    this._activeVersions.set(manifest.id, manifest.version);

    // Update produces inverted index
    if (manifest.produces) {
      for (const prod of manifest.produces) {
        if (!this._byProduces.has(prod)) {
          this._byProduces.set(prod, new Set());
        }
        this._byProduces.get(prod)!.add(manifest.id);
      }
    }

    // Update capability inverted index
    if (manifest.capabilities) {
      for (const cap of manifest.capabilities) {
        if (!this._byCapability.has(cap)) {
          this._byCapability.set(cap, new Set());
        }
        this._byCapability.get(cap)!.add(manifest.id);
      }
    }

    const handle: SkillHandle = {
      id: manifest.id,
      version: manifest.version,
      registryRef: `registry://${manifest.id}@${manifest.version}`,
      lifecycleState: 'unloaded',
    };

    if (this._eventBus) {
      await this._eventBus.publish('skill.registered', {
        id: asUUID(randomUUID()),
        topic: 'skill.registered',
        key: manifest.id,
        payload: { id: manifest.id, version: manifest.version },
        timestamp: Date.now(),
      });
    }

    return handle;
  }

  public async unregister(id: string): Promise<boolean> {
    if (!this._manifests.has(id)) return false;

    this._manifests.delete(id);
    this._activeVersions.delete(id);

    // Clean up indices
    for (const set of this._byProduces.values()) {
      set.delete(id);
    }
    for (const set of this._byCapability.values()) {
      set.delete(id);
    }

    return true;
  }

  public getManifest(id: string, version?: string): SkillManifest | null {
    const versionMap = this._manifests.get(id);
    if (!versionMap) return null;
    if (version) {
      return versionMap.get(version) || null;
    }
    const activeVer = this._activeVersions.get(id);
    return activeVer ? versionMap.get(activeVer) || null : null;
  }

  public getActiveVersion(id: string): SkillManifest | null {
    return this.getManifest(id);
  }

  public listAll(): SkillManifest[] {
    const list: SkillManifest[] = [];
    for (const [id, activeVer] of this._activeVersions.entries()) {
      const m = this._manifests.get(id)?.get(activeVer);
      if (m) list.push({ ...m });
    }
    return list;
  }

  public findByProduces(artifactType: string): SkillManifest[] {
    const ids = this._byProduces.get(artifactType);
    if (!ids) return [];
    const results: SkillManifest[] = [];
    for (const id of ids) {
      const m = this.getActiveVersion(id);
      if (m) results.push(m);
    }
    return results;
  }

  public findByCapability(tag: string): SkillManifest[] {
    const ids = this._byCapability.get(tag);
    if (!ids) return [];
    const results: SkillManifest[] = [];
    for (const id of ids) {
      const m = this.getActiveVersion(id);
      if (m) results.push(m);
    }
    return results;
  }

  public getQuarantined(): QuarantineRecord[] {
    return [...this._quarantine];
  }

  public async scan(roots: string[]): Promise<SkillManifest[]> {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const discovered: SkillManifest[] = [];

    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(root, entry.name, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            try {
              const content = fs.readFileSync(manifestPath, 'utf-8');
              const manifest = JSON.parse(content) as SkillManifest;
              await this.register(manifest, root);
              discovered.push(manifest);
            } catch {
              // Quarantined inside register
            }
          }
        }
      }
    }

    return discovered;
  }
}
