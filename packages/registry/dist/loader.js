"use strict";
/**
 * Concrete Skill Loader implementation.
 * Manages loaded executable skill instances, lifecycle state transitions,
 * in-flight task reference counting, and the RFC-0002a drain/hot-reload protocol.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillLoader = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@agy/shared");
class SkillLoader {
    name = 'skill-loader';
    _registry;
    _eventBus;
    _loadedSkills = new Map();
    _drainingSkills = new Map();
    _isReady = false;
    _bootTime = 0;
    drainTimeoutMs = 30000;
    constructor(options) {
        this._registry = options.registry;
        this._eventBus = options.eventBus;
        if (options.drainTimeoutMs) {
            this.drainTimeoutMs = options.drainTimeoutMs;
        }
    }
    async boot() {
        this._isReady = true;
        this._bootTime = Date.now();
    }
    async shutdown() {
        for (const [id] of Array.from(this._loadedSkills.entries())) {
            await this.unload(id);
        }
        this._isReady = false;
    }
    health() {
        return {
            status: this._isReady ? 'healthy' : 'unhealthy',
            uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
        };
    }
    getLoaded(id) {
        return this._loadedSkills.get(id) || null;
    }
    async load(id, version) {
        if (!this._isReady) {
            throw new shared_1.AgyError('SkillLoader is not ready', {
                code: 'LOADER_NOT_READY',
                subsystem: 'registry',
                retryable: false,
            });
        }
        if (this._loadedSkills.has(id)) {
            const existing = this._loadedSkills.get(id);
            existing.refCount++;
            return existing;
        }
        const manifest = this._registry.getManifest(id, version);
        if (!manifest) {
            throw new shared_1.AgyError(`Skill ${id} not found in registry`, {
                code: 'SKILL_NOT_FOUND',
                subsystem: 'registry',
                retryable: false,
            });
        }
        const handle = {
            id: manifest.id,
            version: manifest.version,
            registryRef: `registry://${manifest.id}@${manifest.version}`,
            lifecycleState: 'loaded',
        };
        const loadedSkill = {
            manifest,
            handle,
            refCount: 1,
            execute: async (ctx) => {
                return {
                    skillId: manifest.id,
                    executedAt: Date.now(),
                    output: `Execution output from ${manifest.name}`,
                    context: ctx,
                };
            },
            dispose: async () => {
                handle.lifecycleState = 'unloaded';
            },
        };
        this._loadedSkills.set(id, loadedSkill);
        if (this._eventBus) {
            await this._eventBus.publish('skill.loaded', {
                id: (0, node_crypto_1.randomUUID)(),
                topic: 'skill.loaded',
                key: id,
                payload: { id, version: manifest.version },
                timestamp: Date.now(),
            });
        }
        return loadedSkill;
    }
    async unload(id) {
        const loaded = this._loadedSkills.get(id);
        if (!loaded)
            return false;
        if (loaded.refCount > 1) {
            loaded.refCount--;
            return false; // Still referenced by in-flight tasks
        }
        loaded.handle.lifecycleState = 'draining';
        this._drainingSkills.set(id, loaded);
        this._loadedSkills.delete(id);
        await loaded.dispose();
        this._drainingSkills.delete(id);
        if (this._eventBus) {
            await this._eventBus.publish('skill.unloaded', {
                id: (0, node_crypto_1.randomUUID)(),
                topic: 'skill.unloaded',
                key: id,
                payload: { id },
                timestamp: Date.now(),
            });
        }
        return true;
    }
    async reload(id) {
        const oldInstance = this._loadedSkills.get(id);
        if (oldInstance) {
            oldInstance.handle.lifecycleState = 'draining';
            this._drainingSkills.set(id, oldInstance);
            this._loadedSkills.delete(id);
        }
        const newInstance = await this.load(id);
        if (oldInstance) {
            setTimeout(async () => {
                await oldInstance.dispose();
                this._drainingSkills.delete(id);
            }, 100);
        }
        return newInstance;
    }
}
exports.SkillLoader = SkillLoader;
//# sourceMappingURL=loader.js.map