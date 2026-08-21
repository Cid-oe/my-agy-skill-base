"use strict";
/**
 * Concrete DAG Scheduler implementation.
 * Enforces DAG dependency ordering, priority aging for anti-starvation (RFC-0007a),
 * bounded dispatch queues, and cooperative cancellation propagation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@agy/shared");
class SimpleCancellationToken {
    isCancellationRequested = false;
    _callbacks = [];
    cancel() {
        this.isCancellationRequested = true;
        for (const cb of this._callbacks) {
            cb();
        }
    }
    onCancelled(callback) {
        if (this.isCancellationRequested) {
            callback();
        }
        else {
            this._callbacks.push(callback);
        }
    }
}
class Scheduler {
    name = 'scheduler';
    _plans = new Map();
    _planTokens = new Map();
    _nodeCompletion = new Map();
    _inFlightPromises = new Map();
    _dispatcher;
    _accepting = true;
    _isReady = false;
    _bootTime = 0;
    _agingFactorMs = 5000;
    _eventBus;
    _runtimeState;
    constructor(options = {}) {
        this._eventBus = options.eventBus;
        this._runtimeState = options.runtimeState;
        if (options.agingFactorMs) {
            this._agingFactorMs = options.agingFactorMs;
        }
    }
    async boot() {
        this._isReady = true;
        this._accepting = true;
        this._bootTime = Date.now();
    }
    async shutdown() {
        this.stopAccepting();
        this._isReady = false;
    }
    stopAccepting() {
        this._accepting = false;
    }
    health() {
        return {
            status: this._isReady ? 'healthy' : 'unhealthy',
            uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
        };
    }
    registerDispatcher(dispatcher) {
        this._dispatcher = dispatcher;
    }
    async submit(plan) {
        if (!this._isReady) {
            throw new shared_1.AgyError('Scheduler is not ready', {
                code: 'SCHEDULER_NOT_READY',
                subsystem: 'scheduler',
                retryable: false,
            });
        }
        if (!this._accepting) {
            throw new shared_1.AgyError('Scheduler is currently draining and not accepting new plans', {
                code: 'SCHEDULER_DRAINING',
                subsystem: 'scheduler',
                retryable: false,
            });
        }
        plan.status = 'running';
        this._plans.set(plan.planId, plan);
        this._planTokens.set(plan.planId, new SimpleCancellationToken());
        this._nodeCompletion.set(plan.planId, new Set());
        this._inFlightPromises.set(plan.planId, []);
        if (this._runtimeState) {
            await this._runtimeState.trackPlan(plan.planId);
        }
        if (this._eventBus) {
            await this._eventBus.publish('scheduler.plan.submitted', {
                id: (0, node_crypto_1.randomUUID)(),
                topic: 'scheduler.plan.submitted',
                key: plan.planId,
                payload: { planId: plan.planId, nodeCount: plan.nodes.length },
                timestamp: Date.now(),
            });
        }
        return plan.planId;
    }
    async cancel(planId) {
        const plan = this._plans.get(planId);
        if (!plan)
            return false;
        plan.status = 'cancelled';
        const token = this._planTokens.get(planId);
        if (token) {
            token.cancel();
        }
        if (this._runtimeState) {
            await this._runtimeState.untrackPlan(planId);
        }
        return true;
    }
    getPlanStatus(planId) {
        const plan = this._plans.get(planId);
        return plan ? plan.status : null;
    }
    async tick() {
        if (!this._isReady || !this._dispatcher)
            return 0;
        let dispatchedCount = 0;
        for (const [planId, plan] of this._plans.entries()) {
            if (plan.status !== 'running')
                continue;
            const completed = this._nodeCompletion.get(planId);
            const readyNodes = this.findReadyNodes(plan, completed);
            if (readyNodes.length === 0 && completed.size === plan.nodes.length) {
                plan.status = 'completed';
                if (this._runtimeState) {
                    await this._runtimeState.untrackPlan(planId);
                }
                continue;
            }
            const now = Date.now();
            const taskQueue = readyNodes.map((node) => ({
                taskId: (0, node_crypto_1.randomUUID)(),
                node,
                planId,
                queuedAt: plan.createdAt,
                basePriority: node.skillRef.id.startsWith('sec') ? 500 : 100,
            }));
            taskQueue.sort((a, b) => {
                const effA = a.basePriority + (now - a.queuedAt) / this._agingFactorMs;
                const effB = b.basePriority + (now - b.queuedAt) / this._agingFactorMs;
                return effB - effA;
            });
            const promises = this._inFlightPromises.get(planId) || [];
            for (const item of taskQueue) {
                if (item.node.state === 'running')
                    continue;
                item.node.state = 'running';
                const cancellationToken = this._planTokens.get(planId) || new SimpleCancellationToken();
                const taskContext = {
                    taskId: item.taskId,
                    nodeId: item.node.nodeId,
                    planId: item.planId,
                    lease: {
                        leaseId: (0, node_crypto_1.randomUUID)(),
                        subject: item.node.skillRef.id,
                        capabilities: [],
                        issuedAt: now,
                        expiresAt: now + (item.node.limits.maxDurationMs || 60000),
                        revoked: false,
                    },
                    cancellationToken,
                };
                dispatchedCount++;
                const p = this._dispatcher(taskContext, item.node)
                    .then(async () => {
                    item.node.state = 'done';
                    completed.add(item.node.nodeId);
                    if (completed.size === plan.nodes.length) {
                        plan.status = 'completed';
                        if (this._runtimeState) {
                            await this._runtimeState.untrackPlan(planId);
                        }
                    }
                })
                    .catch((err) => {
                    console.error(`Error executing task ${item.taskId} on skill ${item.node.skillRef.id}:`, err);
                    item.node.state = 'error';
                });
                promises.push(p);
            }
            // Await in-flight tasks for synchronous settling
            if (promises.length > 0) {
                await Promise.allSettled(promises);
            }
        }
        return dispatchedCount;
    }
    findReadyNodes(plan, completed) {
        const ready = [];
        for (const node of plan.nodes) {
            if (node.state === 'done' || node.state === 'running' || node.state === 'error') {
                continue;
            }
            const incoming = plan.edges.filter((e) => e.toNodeId === node.nodeId && e.kind === 'ordering');
            const satisfied = incoming.every((e) => completed.has(e.fromNodeId));
            if (satisfied) {
                ready.push(node);
            }
        }
        return ready;
    }
}
exports.Scheduler = Scheduler;
//# sourceMappingURL=scheduler.js.map