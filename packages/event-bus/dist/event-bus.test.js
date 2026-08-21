"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const event_bus_js_1 = require("./event-bus.js");
(0, node_test_1.test)('EventBus publishes and delivers events to topic subscribers', async () => {
    const bus = new event_bus_js_1.EventBus();
    await bus.boot();
    const received = [];
    bus.subscribe('task.events', (event) => {
        received.push(event.payload.msg);
    });
    await bus.publish('task.events', {
        id: 'evt-1',
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
        id: 'e1',
        topic: 'counter.topic',
        key: 'order-key-1',
        payload: { seq: 1 },
        timestamp: Date.now(),
    });
    const p2 = bus.publish('counter.topic', {
        id: 'e2',
        topic: 'counter.topic',
        key: 'order-key-1',
        payload: { seq: 2 },
        timestamp: Date.now(),
    });
    const p3 = bus.publish('counter.topic', {
        id: 'e3',
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
    const bus = new event_bus_js_1.EventBus();
    await bus.boot();
    bus.subscribe('failing.topic', () => {
        throw new Error('Subscriber intentional failure');
    });
    await bus.publish('failing.topic', {
        id: 'evt-fail',
        topic: 'failing.topic',
        key: 'fail-key',
        payload: { test: true },
        timestamp: Date.now(),
    });
    const deadLetters = bus.getDeadLetterQueue();
    node_assert_1.default.strictEqual(deadLetters.length, 1);
    node_assert_1.default.strictEqual(deadLetters[0].id, 'evt-fail');
    await bus.shutdown();
});
//# sourceMappingURL=event-bus.test.js.map