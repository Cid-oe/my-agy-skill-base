"use strict";
/**
 * Concrete Skill Registry implementation.
 * Stores validated manifests, maintains inverted capability and produces indices,
 * manages quarantining, and integrates with the Event Bus (RFC-0002).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillRegistry = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@agy/shared");
class SkillRegistry {
    id = (0, shared_1.asUUID)('skill-registry');
    async start() { await this.boot(); }
    async stop() { await this.shutdown(); }
    async getHealth() { return Promise.resolve(this.health()); }
    name = 'skill-registry';
    _manifests = new Map(); // id -> version -> manifest
    _activeVersions = new Map(); // id -> version
    _byProduces = new Map(); // artifact -> Set<id>
    _byCapability = new Map(); // capability -> Set<id>
    _quarantine = [];
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
    health() {
        return {
            status: this._isReady ? 'healthy' : 'unhealthy',
            uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
        };
    }
    async register(manifest, sourceRoot = 'project') {
        if (!this._isReady) {
            throw new shared_1.AgyError('SkillRegistry is not ready', {
                code: 'REGISTRY_NOT_READY',
                subsystem: 'registry',
                retryable: false,
            });
        }
        // Validate minimal requirements
        if (!manifest.id || !manifest.version || !manifest.name) {
            this._quarantine.push({
                path: sourceRoot,
                reason: 'Malformed manifest: Missing required identity fields',
                errors: ['id, version, and name are required'],
                timestamp: Date.now(),
            });
            throw new shared_1.AgyError(`Invalid manifest for ${manifest.id || 'unknown'}`, {
                code: 'MANIFEST_INVALID',
                subsystem: 'registry',
                retryable: false,
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
                this._byProduces.get(prod).add(manifest.id);
            }
        }
        // Update capability inverted index
        if (manifest.capabilities) {
            for (const cap of manifest.capabilities) {
                if (!this._byCapability.has(cap)) {
                    this._byCapability.set(cap, new Set());
                }
                this._byCapability.get(cap).add(manifest.id);
            }
        }
        const handle = {
            id: manifest.id,
            version: manifest.version,
            registryRef: `registry://${manifest.id}@${manifest.version}`,
            lifecycleState: 'unloaded',
        };
        if (this._eventBus) {
            await this._eventBus.publish('skill.registered', {
                id: (0, shared_1.asUUID)((0, node_crypto_1.randomUUID)()),
                topic: 'skill.registered',
                key: manifest.id,
                payload: { id: manifest.id, version: manifest.version },
                timestamp: Date.now(),
            });
        }
        return handle;
    }
    async unregister(id) {
        if (!this._manifests.has(id))
            return false;
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
    getManifest(id, version) {
        const versionMap = this._manifests.get(id);
        if (!versionMap)
            return null;
        if (version) {
            return versionMap.get(version) || null;
        }
        const activeVer = this._activeVersions.get(id);
        return activeVer ? versionMap.get(activeVer) || null : null;
    }
    getActiveVersion(id) {
        return this.getManifest(id);
    }
    listAll() {
        const list = [];
        for (const [id, activeVer] of this._activeVersions.entries()) {
            const m = this._manifests.get(id)?.get(activeVer);
            if (m)
                list.push({ ...m });
        }
        return list;
    }
    findByProduces(artifactType) {
        const ids = this._byProduces.get(artifactType);
        if (!ids)
            return [];
        const results = [];
        for (const id of ids) {
            const m = this.getActiveVersion(id);
            if (m)
                results.push(m);
        }
        return results;
    }
    findByCapability(tag) {
        const ids = this._byCapability.get(tag);
        if (!ids)
            return [];
        const results = [];
        for (const id of ids) {
            const m = this.getActiveVersion(id);
            if (m)
                results.push(m);
        }
        return results;
    }
    getQuarantined() {
        return [...this._quarantine];
    }
    async scan(roots) {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const discovered = [];
        for (const root of roots) {
            if (!fs.existsSync(root))
                continue;
            const entries = fs.readdirSync(root, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const manifestPath = path.join(root, entry.name, 'manifest.json');
                    if (fs.existsSync(manifestPath)) {
                        try {
                            const content = fs.readFileSync(manifestPath, 'utf-8');
                            const manifest = JSON.parse(content);
                            await this.register(manifest, root);
                            discovered.push(manifest);
                        }
                        catch {
                            // Quarantined inside register
                        }
                    }
                }
            }
        }
        return discovered;
    }
}
exports.SkillRegistry = SkillRegistry;
//# sourceMappingURL=registry.js.map