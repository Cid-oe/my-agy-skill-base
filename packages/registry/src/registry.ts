/**
 * Validated skill registry with immutable manifest boundaries, deterministic
 * SemVer activation, safe executable path resolution, and quarantine support.
 */

import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SkillHandle, SkillManifest, SubsystemHealth, AgyError, UUID, asUUID, deepClone } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { ISkillRegistry, QuarantineRecord } from './interfaces.js';
import { validateManifest } from './manifest-validator.js';

export interface SkillRegistryOptions {
  eventBus?: IEventBus;
  schemaPath?: string;
  /** Required to accept manifests carrying a signature. */
  signatureVerifier?: (manifest: SkillManifest) => boolean | Promise<boolean>;
}

export class SkillRegistry implements ISkillRegistry {
  public readonly id: UUID = asUUID('skill-registry');
  public readonly name = 'skill-registry';
  private _manifests = new Map<string, Map<string, SkillManifest>>();
  private _activeVersions = new Map<string, string>();
  private _byProduces = new Map<string, Set<string>>();
  private _byCapability = new Map<string, Set<string>>();
  private _quarantine: QuarantineRecord[] = [];
  private _isReady = false;
  private _bootTime = 0;
  private _eventBus?: IEventBus;
  private _schemaPath?: string;
  private _signatureVerifier?: SkillRegistryOptions['signatureVerifier'];

  constructor(options: SkillRegistryOptions = {}) {
    this._eventBus = options.eventBus;
    this._schemaPath = options.schemaPath;
    this._signatureVerifier = options.signatureVerifier;
  }

  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }

  public async boot(): Promise<void> {
    if (this._isReady) return;
    this._isReady = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> { this._isReady = false; }

  public health(): SubsystemHealth {
    return { status: this._isReady ? 'healthy' : 'unhealthy', uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0 };
  }

  public async register(manifest: SkillManifest, sourceRoot?: string): Promise<SkillHandle> {
    if (!this._isReady) throw new AgyError('SkillRegistry is not ready', { code: 'REGISTRY_NOT_READY', subsystem: 'registry', retryable: false });
    const candidate = deepClone(manifest);
    const issues = validateManifest(candidate, this._schemaPath);
    const missingIdentity = !candidate?.id || !candidate?.version || !candidate?.name;
    const errors = missingIdentity
      ? ['id, version, and name are required']
      : issues.map((issue) => `${issue.path}: ${issue.message}`);
    if (missingIdentity || issues.length > 0) return this.quarantineAndReject(candidate?.id, sourceRoot ?? 'project', errors, missingIdentity ? 'Malformed manifest: Missing required identity fields' : 'Manifest failed schema validation');

    try {
      if (candidate.signature && !this._signatureVerifier) throw new Error('signed manifest cannot be verified: no signature verifier configured');
      if (candidate.signature && this._signatureVerifier && !(await this._signatureVerifier(candidate))) throw new Error('manifest signature verification failed');
      if (candidate.checksum && !/^[a-f0-9]{64}$/i.test(candidate.checksum)) throw new Error('checksum must be a SHA-256 hex digest');
      if (candidate.modulePath) this.validateModulePath(candidate.modulePath, sourceRoot);
      if (candidate.checksum && candidate.modulePath) {
        const actual = createHash('sha256').update(fs.readFileSync(candidate.modulePath)).digest('hex');
        if (actual !== candidate.checksum.toLowerCase()) throw new Error('module checksum mismatch');
      }
    } catch (err) {
      return this.quarantineAndReject(candidate.id, sourceRoot ?? 'project', [err instanceof Error ? err.message : String(err)], 'Manifest executable validation failed');
    }

    let versions = this._manifests.get(candidate.id);
    if (!versions) { versions = new Map(); this._manifests.set(candidate.id, versions); }
    versions.set(candidate.version, candidate);
    const current = this._activeVersions.get(candidate.id);
    if (!current || compareSemVer(candidate.version, current) > 0) this._activeVersions.set(candidate.id, candidate.version);

    for (const produced of candidate.produces ?? []) {
      if (!this._byProduces.has(produced)) this._byProduces.set(produced, new Set());
      this._byProduces.get(produced)!.add(candidate.id);
    }
    for (const capability of candidate.capabilities ?? []) {
      if (!this._byCapability.has(capability)) this._byCapability.set(capability, new Set());
      this._byCapability.get(capability)!.add(candidate.id);
    }

    const handle: SkillHandle = {
      id: candidate.id, version: candidate.version,
      registryRef: `registry://${candidate.id}@${candidate.version}`, lifecycleState: 'unloaded',
    };
    if (this._eventBus) {
      try {
        await this._eventBus.publish('skill.registered', {
          id: asUUID(randomUUID()), topic: 'skill.registered', key: candidate.id,
          payload: { id: candidate.id, version: candidate.version }, timestamp: Date.now(),
        });
      } catch (err) { console.error('[SkillRegistry] registration event failed:', err); }
    }
    return handle;
  }

  public async unregister(id: string): Promise<boolean> {
    if (!this._isReady) throw new AgyError('SkillRegistry is not ready', { code: 'REGISTRY_NOT_READY', subsystem: 'registry', retryable: false });
    if (!this._manifests.has(id)) return false;
    this._manifests.delete(id);
    this._activeVersions.delete(id);
    for (const set of this._byProduces.values()) set.delete(id);
    for (const set of this._byCapability.values()) set.delete(id);
    return true;
  }

  public getManifest(id: string, version?: string): SkillManifest | null {
    const versions = this._manifests.get(id);
    if (!versions) return null;
    const selected = version ? versions.get(version) : this._activeVersions.get(id) ? versions.get(this._activeVersions.get(id)!) : undefined;
    return selected ? deepClone(selected) : null;
  }

  public getActiveVersion(id: string): SkillManifest | null { return this.getManifest(id); }

  public listAll(): SkillManifest[] {
    const list: SkillManifest[] = [];
    for (const [id, version] of this._activeVersions) {
      const manifest = this._manifests.get(id)?.get(version);
      if (manifest) list.push(deepClone(manifest));
    }
    return list;
  }

  public findByProduces(artifactType: string): SkillManifest[] {
    return [...(this._byProduces.get(artifactType) ?? [])]
      .map((id) => this.getActiveVersion(id)).filter((manifest): manifest is SkillManifest => manifest !== null);
  }

  public findByCapability(tag: string): SkillManifest[] {
    return [...(this._byCapability.get(tag) ?? [])]
      .map((id) => this.getActiveVersion(id)).filter((manifest): manifest is SkillManifest => manifest !== null);
  }

  public getQuarantined(): QuarantineRecord[] { return deepClone(this._quarantine); }

  public async scan(roots: string[], maxDepth = 8): Promise<SkillManifest[]> {
    const discovered: SkillManifest[] = [];
    const visited = new Set<string>();
    const visit = async (dir: string, depth: number): Promise<void> => {
      if (depth < 0) return;
      let real: string;
      try { real = fs.realpathSync(dir); } catch { return; }
      if (visited.has(real)) return;
      visited.add(real);
      const manifestPath = path.join(real, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as SkillManifest;
          if (!manifest.modulePath && manifest.entryPoint) {
            const modulePath = path.resolve(real, manifest.entryPoint);
            assertContained(real, modulePath);
            if (!fs.statSync(modulePath).isFile()) throw new Error(`entryPoint does not identify a file: ${manifest.entryPoint}`);
            manifest.modulePath = fs.realpathSync(modulePath);
          } else if (manifest.modulePath) {
            const modulePath = path.isAbsolute(manifest.modulePath) ? manifest.modulePath : path.resolve(real, manifest.modulePath);
            this.validateModulePath(modulePath, real);
            manifest.modulePath = fs.realpathSync(modulePath);
          }
          await this.register(manifest, real);
          discovered.push(deepClone(manifest));
        } catch (err) {
          if (!(err instanceof AgyError && err.code === 'MANIFEST_INVALID')) {
            this._quarantine.push({ path: manifestPath, reason: 'Malformed manifest: failed to parse or validate', errors: [err instanceof Error ? err.message : String(err)], timestamp: Date.now() });
          }
        }
      }
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(real, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) if (entry.isDirectory()) await visit(path.join(real, entry.name), depth - 1);
    };
    for (const root of roots) await visit(root, maxDepth);
    return discovered;
  }

  private validateModulePath(modulePath: string, sourceRoot?: string): void {
    if (!path.isAbsolute(modulePath)) throw new Error('modulePath must be absolute after registration');
    const resolved = fs.realpathSync(modulePath);
    if (!fs.statSync(resolved).isFile()) throw new Error('modulePath must identify a regular file');
    if (!/\.(?:mjs|cjs|js)$/i.test(resolved)) throw new Error('modulePath must be a JavaScript module');
    if (sourceRoot && path.isAbsolute(sourceRoot)) assertContained(fs.realpathSync(sourceRoot), resolved);
  }

  private async quarantineAndReject(id: string | undefined, source: string, errors: string[], reason: string): Promise<never> {
    this._quarantine.push({ path: source, reason, errors, timestamp: Date.now() });
    throw new AgyError(`Invalid manifest for ${id || 'unknown'}`, { code: 'MANIFEST_INVALID', subsystem: 'registry', retryable: false, details: { errors } });
  }
}

function assertContained(root: string, target: string): void {
  const relative = path.relative(root, target);
  if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw new Error('module path escapes skill root');
}

function parseSemVer(value: string): { major: number; minor: number; patch: number; pre: string[] } | null {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ? match[4].split('.') : [] } : null;
}

function compareSemVer(a: string, b: string): number {
  const left = parseSemVer(a); const right = parseSemVer(b);
  if (!left || !right) return a.localeCompare(b);
  for (const key of ['major', 'minor', 'patch'] as const) if (left[key] !== right[key]) return left[key] - right[key];
  if (left.pre.length === 0 && right.pre.length > 0) return 1;
  if (left.pre.length > 0 && right.pre.length === 0) return -1;
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    if (left.pre[i] === right.pre[i]) continue;
    if (left.pre[i] === undefined) return -1;
    if (right.pre[i] === undefined) return 1;
    const ln = /^\d+$/.test(left.pre[i]); const rn = /^\d+$/.test(right.pre[i]);
    if (ln && rn) return Number(left.pre[i]) - Number(right.pre[i]);
    if (ln) return -1; if (rn) return 1;
    return left.pre[i].localeCompare(right.pre[i]);
  }
  return 0;
}
