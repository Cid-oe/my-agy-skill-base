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
    id = (0, shared_1.asUUID)('event-bus');
    name = 'event-bus';
    _keyQueues = new Map();
    _deadLetterQueue = [];
    _isReady = false;
    _processedCount = 0;
    _errorCount = 0;
    _bootTime = 0;
    _subscriptions = new Map();
    _maxQueueLengthPerKey;
    _maxRetries;
    _backoffBaseMs;
    _maxDeadLetters;
    constructor(options = {}) {
        this._maxQueueLengthPerKey = options.maxQueueLengthPerKey ?? 1000;
        this._maxRetries = options.maxRetries ?? 3;
        this._backoffBaseMs = options.backoffBaseMs ?? 50;
        this._maxDeadLetters = options.maxDeadLetters ?? 500;
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
        // Wait for all in-flight queues to finish
        while (this._keyQueues.size > 0) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
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
    clearDeadLetters() {
        this._deadLetterQueue = [];
    }
    subscribe(topic, handler) {
        if (!this._subscriptions.has(topic)) {
            this._subscriptions.set(topic, []);
        }
        const id = (0, shared_1.asUUID)((0, node_crypto_1.randomUUID)());
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
        return new Promise((resolve, reject) => {
            let keyQueue = this._keyQueues.get(key);
            if (!keyQueue) {
                keyQueue = { items: [], running: false };
                this._keyQueues.set(key, keyQueue);
            }
            if (keyQueue.items.length >= this._maxQueueLengthPerKey) {
                return reject(new shared_1.AgyError(`Queue limit exceeded for key ${key}`, {
                    code: 'QUEUE_OVERFLOW',
                    subsystem: 'event-bus',
                    retryable: true,
                }));
            }
            keyQueue.items.push({
                topic,
                event: event,
                resolve,
                reject,
            });
            if (!keyQueue.running) {
                this.processKeyQueue(key, keyQueue);
            }
        });
    }
    async processKeyQueue(key, keyQueue) {
        keyQueue.running = true;
        while (keyQueue.items.length > 0) {
            const item = keyQueue.items.shift();
            try {
                await this.dispatchToSubscribers(item.topic, item.event);
                item.resolve();
            }
            catch (err) {
                this._errorCount++;
                this.recordDeadLetter(item.event);
                console.error(`[EventBus] Handled error by routing event ${item.event.id} to DLQ on key ${key}:`, err);
                item.resolve();
            }
        }
        // Clean up empty key queues immediately to prevent memory leaks
        this._keyQueues.delete(key);
    }
    recordDeadLetter(event) {
        if (this._deadLetterQueue.length >= this._maxDeadLetters) {
            this._deadLetterQueue.shift();
        }
        this._deadLetterQueue.push(event);
    }
    async dispatchToSubscribers(topic, event) {
        const subs = this._subscriptions.get(topic) || [];
        const wildcardSubs = this._subscriptions.get('*') || [];
        const allSubs = [...subs, ...wildcardSubs];
        for (const sub of allSubs) {
            let attempts = 0;
            let delivered = false;
            while (attempts < this._maxRetries && !delivered) {
                attempts++;
                try {
                    await sub.handler(event);
                    delivered = true;
                    this._processedCount++;
                }
                catch (err) {
                    if (attempts >= this._maxRetries) {
                        throw err;
                    }
                    const backoff = this._backoffBaseMs * Math.pow(2, attempts - 1) + Math.random() * 20;
                    await new Promise((resolve) => setTimeout(resolve, backoff));
                }
            }
        }
    }
}
exports.EventBus = EventBus;
//# sourceMappingURL=event-bus.js.map