import { test } from 'node:test';
import assert from 'node:assert';
import { EventBus } from './event-bus.js';
import { Event } from '@agy/shared';

test('EventBus publishes and delivers events to topic subscribers', async () => {
  const bus = new EventBus();
  await bus.boot();

  const received: string[] = [];
  bus.subscribe('task.events', (event: Event<{ msg: string }>) => {
    received.push(event.payload.msg);
  });

  await bus.publish('task.events', {
    id: 'evt-1',
    topic: 'task.events',
    key: 'plan-1',
    payload: { msg: 'hello' },
    timestamp: Date.now(),
  });

  assert.strictEqual(received.length, 1);
  assert.strictEqual(received[0], 'hello');

  await bus.shutdown();
});

test('EventBus enforces strict FIFO delivery per ordering key', async () => {
  const bus = new EventBus();
  await bus.boot();

  const order: number[] = [];
  bus.subscribe('counter.topic', async (event: Event<{ seq: number }>) => {
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

  assert.deepStrictEqual(order, [1, 2, 3]);
  await bus.shutdown();
});

test('EventBus captures failed events in dead-letter queue after max retries', async () => {
  const bus = new EventBus();
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
  assert.strictEqual(deadLetters.length, 1);
  assert.strictEqual(deadLetters[0].id, 'evt-fail');

  await bus.shutdown();
});
