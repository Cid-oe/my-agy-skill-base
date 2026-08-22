"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const event_bus_js_1 = require("./event-bus.js");
const shared_1 = require("@agy/shared");
(0, node_test_1.test)('EventBus publishes and delivers events to topic subscribers', async () => {
    const bus = new event_bus_js_1.EventBus();
    await bus.boot();
    const received = [];
    bus.subscribe('task.events', (event) => {
        received.push(event.payload.msg);
    });
    await bus.publish('task.events', {
        id: (0, shared_1.asUUID)('evt-1'),
        topic: 'task.events',
        key: 'plan-1',
        payload: { msg: 'hello' },
        timestamp: Date.now(),
    });
    node_assert_1.default.strictEqual(received.length, 1);
    node_assert_1.default.strictEqual(received[0], 'hello');
    await bus.shutdown();
});
(0, node_test_1.test)('EventBus enforces strict FIFO delivery per ordering key', async () => {
    const bus = new event_bus_js_1.EventBus();
    await bus.boot();
    const order = [];
    bus.subscribe('counter.topic', async (event) => {
        // Artificial small delay to test sequential execution under concurrency
        await new Promise((r) => setTimeout(r, 10));
        order.push(event.payload.seq);
    });
    const p1 = bus.publish('counter.topic', {
        id: (0, shared_1.asUUID)('e1'),
        topic: 'counter.topic',
        key: 'order-key-1',
        payload: { seq: 1 },
        timestamp: Date.now(),
    });
    const p2 = bus.publish('counter.topic', {
        id: (0, shared_1.asUUID)('e2'),
        topic: 'counter.topic',
        key: 'order-key-1',
        payload: { seq: 2 },
        timestamp: Date.now(),
    });
    const p3 = bus.publish('counter.topic', {
        id: (0, shared_1.asUUID)('e3'),
        topic: 'counter.topic',
        key: 'order-key-1',
        payload: { seq: 3 },
        timestamp: Date.now(),
    });
    await Promise.all([p1, p2, p3]);
    node_assert_1.default.deepStrictEqual(order, [1, 2, 3]);
    await bus.shutdown();
});
(0, node_test_1.test)('EventBus captures failed events in dead-letter queue after max retries', async () => {
    const bus = new event_bus_js_1.EventBus({ backoffBaseMs: 5 });
    await bus.boot();
    bus.subscribe('failing.topic', () => {
        throw new Error('Subscriber intentional failure');
    });
    await bus.publish('failing.topic', {
        id: (0, shared_1.asUUID)('evt-fail'),
        topic: 'failing.topic',
        key: 'fail-key',
        payload: { test: true },
        timestamp: Date.now(),
    });
    const deadLetters = bus.getDeadLetterQueue();
    node_assert_1.default.strictEqual(deadLetters.length, 1);
    node_assert_1.default.strictEqual(deadLetters[0].id, (0, shared_1.asUUID)('evt-fail'));
    bus.clearDeadLetters();
    node_assert_1.default.strictEqual(bus.getDeadLetterQueue().length, 0);
    await bus.shutdown();
});
(0, node_test_1.test)('EventBus preserves strict sequential FIFO delivery across concurrent publishers', async () => {
    const bus = new event_bus_js_1.EventBus({ maxQueueLengthPerKey: 10000 });
    await bus.boot();
    const totalKeys = 5;
    const eventsPerKey = 50;
    const receivedPerKey = new Map();
    for (let k = 0; k < totalKeys; k++) {
        const key = `key-${k}`;
        receivedPerKey.set(key, []);
        bus.subscribe(`topic.${key}`, async (event) => {
            await new Promise((r) => setTimeout(r, 2));
            receivedPerKey.get(key).push(event.payload.seq);
        });
    }
    const promises = [];
    for (let seq = 0; seq < eventsPerKey; seq++) {
        for (let k = 0; k < totalKeys; k++) {
            const key = `key-${k}`;
            promises.push(bus.publish(`topic.${key}`, {
                id: (0, shared_1.asUUID)(`evt-${key}-${seq}`),
                topic: `topic.${key}`,
                key,
                payload: { seq },
                timestamp: Date.now(),
            }));
        }
    }
    await Promise.all(promises);
    for (let k = 0; k < totalKeys; k++) {
        const key = `key-${k}`;
        const received = receivedPerKey.get(key);
        node_assert_1.default.strictEqual(received.length, eventsPerKey);
        for (let i = 0; i < eventsPerKey; i++) {
            node_assert_1.default.strictEqual(received[i], i, `Key ${key} sequence mismatch at index ${i}`);
        }
    }
    await bus.shutdown();
});
(0, node_test_1.test)('EventBus cleans up per-key queues on drain and avoids memory leaks', async () => {
    const bus = new event_bus_js_1.EventBus();
    await bus.boot();
    // Publish across 500 distinct keys
    for (let i = 0; i < 500; i++) {
        await bus.publish(`distinct.topic`, {
            id: (0, shared_1.asUUID)(`evt-distinct-${i}`),
            topic: `distinct.topic`,
            key: `key-unique-${i}`,
            payload: { value: i },
            timestamp: Date.now(),
        });
    }
    // Internal queue map should have drained back to 0
    node_assert_1.default.strictEqual(bus._keyQueues.size, 0);
    await bus.shutdown();
});
(0, node_test_1.test)('EventBus retries with exponential backoff on subscriber errors before DLQ routing', async () => {
    let attemptCount = 0;
    const bus = new event_bus_js_1.EventBus({ maxRetries: 3, backoffBaseMs: 15 });
    await bus.boot();
    bus.subscribe('retry.topic', () => {
        attemptCount++;
        throw new Error('Transient error');
    });
    const start = Date.now();
    await bus.publish('retry.topic', {
        id: (0, shared_1.asUUID)('evt-retry-test'),
        topic: 'retry.topic',
        key: 'k1',
        payload: {},
        timestamp: Date.now(),
    });
    const elapsed = Date.now() - start;
    node_assert_1.default.strictEqual(attemptCount, 3);
    node_assert_1.default.strictEqual(bus.getDeadLetterQueue().length, 1);
    node_assert_1.default.strictEqual(elapsed >= 25, true, `Expected elapsed >= 25ms due to backoff, got ${elapsed}ms`);
    await bus.shutdown();
});
//# sourceMappingURL=event-bus.test.js.map