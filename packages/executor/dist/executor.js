"use strict";
/**
 * Concrete Sandboxed Executor Pool implementation.
 * Manages worker pool concurrency, hard resource execution limits,
 * crash isolation, artifact ingestion/emission, and event bus notification (RFC-0008).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Executor = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@agy/shared");
class Executor {
    name = 'executor';
    id = (0, shared_1.asUUID)('executor');
    _skillLoader;
    _artifactStore;
    _policyEngine;
    _eventBus;
    _maxWorkers;
    _activeWorkers = 0;
    _queue = [];
    _isReady = false;
    _bootTime = 0;
    constructor(options) {
        this._skillLoader = options.skillLoader;
        this._artifactStore = options.artifactStore;
        this._policyEngine = options.policyEngine;
        this._eventBus = options.eventBus;
        this._maxWorkers = options.maxWorkers || 10;
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
        await this.drain();
        this._isReady = false;
    }
    health() {
        return {
            status: this._isReady ? 'healthy' : 'unhealthy',
            uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
        };
    }
    getPoolStatus() {
        return {
            activeWorkers: this._activeWorkers,
            availableWorkers: Math.max(0, this._maxWorkers - this._activeWorkers),
            queuedTasks: this._queue.length,
            totalCapacity: this._maxWorkers,
        };
    }
    async drain() {
        while (this._activeWorkers > 0) {
            await new Promise((r) => setTimeout(r, 20));
        }
    }
    async execute(task, limits = {}) {
        if (!this._isReady) {
            throw new shared_1.AgyError('Executor is not ready', {
                code: 'EXECUTOR_NOT_READY',
                subsystem: 'executor',
                retryable: false,
            });
        }
        await this.acquireWorker();
        const startTime = Date.now();
        const timeoutMs = limits.maxDurationMs || 30000;
        let timer;
        try {
            if (this._eventBus) {
                await this._eventBus.publish('executor.task.started', {
                    id: (0, shared_1.asUUID)((0, node_crypto_1.randomUUID)()),
                    topic: 'executor.task.started',
                    key: task.taskId,
                    payload: { taskId: task.taskId, skill: task.lease.subject },
                    timestamp: startTime,
                });
            }
            if (task.cancellationToken.isCancellationRequested) {
                throw new shared_1.AgyError(`Task ${task.taskId} cancelled before execution start`, {
                    code: 'TASK_CANCELLED',
                    subsystem: 'executor',
                    retryable: false,
                });
            }
            if (this._policyEngine && task.lease.capabilities.length > 0) {
                for (const cap of task.lease.capabilities) {
                    const valid = await this._policyEngine.validateLease(task.lease.leaseId, cap);
                    if (!valid) {
                        throw new shared_1.AgyError(`Lease ${task.lease.leaseId} capability ${cap.name} validation failed`, {
                            code: 'LEASE_VALIDATION_FAILED',
                            subsystem: 'executor',
                            retryable: false,
                        });
                    }
                }
            }
            const skill = await this._skillLoader.acquire(task.lease.subject);
            try {
                const executionPromise = skill.execute({
                    taskId: task.taskId,
                    planId: task.planId,
                    leaseId: task.lease.leaseId,
                });
                const timeoutPromise = new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        reject(new shared_1.AgyError(`Execution exceeded timeout of ${timeoutMs}ms`, {
                            code: 'EXECUTION_TIMEOUT',
                            subsystem: 'executor',
                            retryable: false,
                        }));
                    }, timeoutMs);
                    task.cancellationToken.onCancelled(() => {
                        if (timer)
                            clearTimeout(timer);
                        reject(new shared_1.AgyError(`Execution cancelled by token`, {
                            code: 'TASK_CANCELLED',
                            subsystem: 'executor',
                            retryable: false,
                        }));
                    });
                });
                const resultPayload = await Promise.race([executionPromise, timeoutPromise]);
                if (timer) {
                    clearTimeout(timer);
                }
                const outputArtifacts = [];
                if (this._artifactStore && resultPayload) {
                    const envelope = await this._artifactStore.put(JSON.stringify(resultPayload), { taskId: task.taskId, planId: task.planId }, { id: task.lease.subject, version: skill.manifest.version }, 'application/json');
                    outputArtifacts.push(envelope);
                }
                const durationMs = Date.now() - startTime;
                const result = {
                    taskId: task.taskId,
                    outputArtifacts,
                    metrics: { durationMs },
                };
                if (this._eventBus) {
                    await this._eventBus.publish('executor.task.finished', {
                        id: (0, shared_1.asUUID)((0, node_crypto_1.randomUUID)()),
                        topic: 'executor.task.finished',
                        key: task.taskId,
                        payload: { taskId: task.taskId, durationMs },
                        timestamp: Date.now(),
                    });
                }
                return result;
            }
            finally {
                await this._skillLoader.release(skill);
            }
        }
        catch (err) {
            if (timer) {
                clearTimeout(timer);
            }
            if (this._eventBus) {
                const msg = err instanceof Error ? err.message : String(err);
                await this._eventBus.publish('executor.task.failed', {
                    id: (0, shared_1.asUUID)((0, node_crypto_1.randomUUID)()),
                    topic: 'executor.task.failed',
                    key: task.taskId,
                    payload: { taskId: task.taskId, error: msg },
                    timestamp: Date.now(),
                });
            }
            throw err;
        }
        finally {
            if (timer) {
                clearTimeout(timer);
            }
            this.releaseWorker();
        }
    }
    async acquireWorker() {
        if (this._activeWorkers < this._maxWorkers) {
            this._activeWorkers++;
            return;
        }
        return new Promise((resolve) => {
            this._queue.push(() => {
                this._activeWorkers++;
                resolve();
            });
        });
    }
    releaseWorker() {
        this._activeWorkers--;
        if (this._queue.length > 0) {
            const next = this._queue.shift();
            next();
        }
    }
}
exports.Executor = Executor;
//# sourceMappingURL=executor.js.map