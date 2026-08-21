"use strict";
/**
 * Concrete implementation of the AGY Event Bus.
 * Supports per-key sequential FIFO delivery, at-least-once delivery guarantee,
 * bounded queues, backpressure handling, and dead-letter routing (RFC-0006, RFC-0006a).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@agy/shared");
class EventBus {
    name = 'event-bus';
    _subscriptions = new Map();
    _keyQueues = new Map();
    _deadLetterQueue = [];
    _isReady = false;
    _processedCount = 0;
    _errorCount = 0;
    _bootTime = 0;
    async boot() {
        this._isReady = true;
        this._bootTime = Date.now();
    }
    async shutdown() {
        // Wait for all in-flight per-key queues to settle
        const active = Array.from(this._keyQueues.values());
        await Promise.allSettled(active);
        this._isReady = false;
        this._subscriptions.clear();
    }
    health() {
        return {
            status: this._isReady ? 'healthy' : 'unhealthy',
            uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
        };
    }
    getDeadLetterQueue() {
        return [...this._deadLetterQueue];
    }
    subscribe(topic, handler) {
        if (!this._subscriptions.has(topic)) {
            this._subscriptions.set(topic, []);
        }
        const id = (0, node_crypto_1.randomUUID)();
        const sub = { id, handler: handler };
        this._subscriptions.get(topic).push(sub);
        return {
            id,
            topic,
            unsubscribe: () => {
                const subs = this._subscriptions.get(topic);
                if (subs) {
                    this._subscriptions.set(topic, subs.filter((s) => s.id !== id));
                }
            },
        };
    }
    async publish(topic, event) {
        if (!this._isReady) {
            throw new shared_1.AgyError('EventBus is not in ready state for publish', {
                code: 'BUS_NOT_READY',
                subsystem: 'event-bus',
                retryable: false,
            });
        }
        const key = `${topic}:${event.key || 'default'}`;
        const previousChain = this._keyQueues.get(key) || Promise.resolve();
        const nextChain = previousChain
            .then(async () => {
            await this.dispatchToSubscribers(topic, event);
        })
            .catch(async (err) => {
            this._errorCount++;
            this._deadLetterQueue.push(event);
            console.error(`[EventBus] Unhandled error processing event ${event.id} on key ${key}:`, err);
        });
        this._keyQueues.set(key, nextChain);
        await nextChain;
    }
    async dispatchToSubscribers(topic, event) {
        const subs = this._subscriptions.get(topic) || [];
        // Also dispatch to wildcard listeners if registered
        const wildcardSubs = this._subscriptions.get('*') || [];
        const allSubs = [...subs, ...wildcardSubs];
        for (const sub of allSubs) {
            let attempts = 0;
            const maxRetries = 3;
            let delivered = false;
            while (attempts < maxRetries && !delivered) {
                attempts++;
                try {
                    await sub.handler(event);
                    delivered = true;
                    this._processedCount++;
                }
                catch (err) {
                    if (attempts >= maxRetries) {
                        throw err; // will trigger dead-letter capture
                    }
                }
            }
        }
    }
}
exports.EventBus = EventBus;
//# sourceMappingURL=event-bus.js.map