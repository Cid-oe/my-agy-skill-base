"use strict";
/**
 * Concrete Reflection Engine implementation.
 * Provides read-only introspection over runtime state snapshots,
 * lease metrics, and system diagnostics without state mutation paths (RFC-0011).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReflectionEngine = void 0;
const shared_1 = require("@agy/shared");
class ReflectionEngine {
    id = (0, shared_1.asUUID)('reflection');
    name = 'reflection';
    _runtimeState;
    _isReady = false;
    _bootTime;
    constructor(options) {
        this._runtimeState = options.runtimeState;
    }
    async start() {
        await this.boot();
    }
    async stop() {
        await this.shutdown();
    }
    async getHealth() {
        return Promise.resolve(this.health());
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
    async inspectRuntime() {
        if (!this._isReady) {
            throw new shared_1.AgyError('ReflectionEngine is not ready', {
                code: 'REFLECTION_NOT_READY',
                subsystem: 'reflection',
                retryable: false,
            });
        }
        const snapshot = this._runtimeState.getSnapshot();
        const now = Date.now();
        const activeLeaseCount = Object.values(snapshot.leases).filter((l) => !l.revoked && now <= l.expiresAt).length;
        const activePlanCount = snapshot.activePlans.length;
        const diagnostics = [
            `Kernel Runtime Version: ${snapshot.version}`,
            `Active Plans: ${activePlanCount}`,
            `Active Leases: ${activeLeaseCount}`,
        ];
        return {
            timestamp: Date.now(),
            runtimeVersion: snapshot.version,
            activePlanCount,
            activeLeaseCount,
            snapshot,
            diagnostics,
        };
    }
}
exports.ReflectionEngine = ReflectionEngine;
//# sourceMappingURL=reflection-engine.js.map