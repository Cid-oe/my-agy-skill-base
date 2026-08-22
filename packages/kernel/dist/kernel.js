"use strict";
/**
 * Concrete implementation of the AGY Kernel composition root.
 * Enforces Phase 5 dependency-ordered startup and graceful drain/shutdown.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Kernel = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@agy/shared");
class Kernel {
    _state = 'uninitialized';
    _kernelId = (0, shared_1.asUUID)((0, node_crypto_1.randomUUID)());
    _container = new shared_1.Container();
    _subsystems = [];
    _config = {};
    _bootedAt = 0;
    constructor(container) {
        if (container) {
            this._container = container;
        }
    }
    get state() {
        return this._state;
    }
    getContainer() {
        return this._container;
    }
    registerSubsystem(subsystem) {
        if (this._state !== 'uninitialized') {
            throw new shared_1.AgyError(`Cannot register subsystem '${subsystem.name}' while kernel is in state '${this._state}'`, { code: 'INVALID_STATE', subsystem: 'kernel', retryable: false });
        }
        this._subsystems.push(subsystem);
    }
    async boot(config = {}) {
        if (this._state === 'ready') {
            return this.createHandle();
        }
        if (this._state !== 'uninitialized' && this._state !== 'shutdown') {
            throw new shared_1.AgyError(`Cannot boot kernel from state '${this._state}'`, {
                code: 'INVALID_STATE',
                subsystem: 'kernel',
                retryable: false,
            });
        }
        this._config = config;
        this._kernelId = config.kernelId || (0, shared_1.asUUID)((0, node_crypto_1.randomUUID)());
        this._state = 'booting';
        this._bootedAt = Date.now();
        const bootedSubsystems = [];
        try {
            // Step 1: Initialize container configuration
            this._container.register('config', this._config);
            this._container.register('kernelId', this._kernelId);
            // Step 2-8: Sequential dependency-ordered subsystem boot
            for (const subsystem of this._subsystems) {
                await subsystem.boot();
                bootedSubsystems.push(subsystem);
                this._container.register(subsystem.name, subsystem);
            }
            this._state = 'ready';
            return this.createHandle();
        }
        catch (err) {
            // Reverse-order rollback on boot failure (Phase 7 / RFC-0000)
            for (const sub of [...bootedSubsystems].reverse()) {
                try {
                    await sub.shutdown();
                }
                catch (rollbackErr) {
                    console.error(`Error during rollback shutdown of ${sub.name}:`, rollbackErr);
                }
            }
            this._state = 'shutdown';
            const msg = err instanceof Error ? err.message : String(err);
            throw new shared_1.AgyError(`Kernel boot failed: ${msg}`, {
                code: 'BOOT_FAILED',
                subsystem: 'kernel',
                retryable: false,
                details: { originalError: msg },
            });
        }
    }
    async shutdown() {
        if (this._state === 'shutdown') {
            return; // idempotent shutdown per Phase 3
        }
        this._state = 'draining';
        // Reverse order shutdown per Phase 5
        const reversed = [...this._subsystems].reverse();
        for (const subsystem of reversed) {
            try {
                await subsystem.shutdown();
            }
            catch (err) {
                // Log & proceed to guarantee all subsystems get shutdown chance
                console.error(`Error shutting down subsystem ${subsystem.name}:`, err);
            }
        }
        this._state = 'shutdown';
    }
    async health() {
        const report = {
            kernel: {
                status: this._state === 'ready' ? 'healthy' : this._state === 'degraded' ? 'degraded' : 'unhealthy',
                uptimeMs: this._bootedAt ? Date.now() - this._bootedAt : 0,
            },
        };
        // Parallelized health checks with individual timeout guards (RFC-0015)
        const healthPromises = this._subsystems.map(async (subsystem) => {
            try {
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Health check timeout for ${subsystem.name}`)), 2000));
                const health = await Promise.race([subsystem.health(), timeoutPromise]);
                return { name: subsystem.name, health };
            }
            catch (err) {
                return {
                    name: subsystem.name,
                    health: {
                        status: 'unhealthy',
                        lastError: err instanceof Error ? err.message : String(err),
                        uptimeMs: 0,
                    },
                };
            }
        });
        const results = await Promise.allSettled(healthPromises);
        for (const res of results) {
            if (res.status === 'fulfilled') {
                report[res.value.name] = res.value.health;
            }
        }
        return report;
    }
    createHandle() {
        return {
            kernelId: this._kernelId,
            state: this._state,
            container: this._container,
            shutdown: () => this.shutdown(),
            health: () => this.health(),
        };
    }
}
exports.Kernel = Kernel;
//# sourceMappingURL=kernel.js.map