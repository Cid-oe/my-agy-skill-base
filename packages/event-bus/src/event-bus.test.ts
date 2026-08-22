import { test } from 'node:test';
import assert from 'node:assert';
import { EventBus } from './event-bus.js';
import { Event, asUUID } from '@agy/shared';

test('EventBus publishes and delivers events to topic subscribers', async () => {
  const bus = new EventBus();
  await bus.boot();

  const received: string[] = [];
  bus.subscribe('task.events', (event: Event<{ msg: string }>) => {
    received.push(event.payload.msg);
  });

  await bus.publish('task.events', {
    id: asUUID('evt-1'),
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
    id: asUUID('e1'),
    topic: 'counter.topic',
    key: 'order-key-1',
    payload: { seq: 1 },
    timestamp: Date.now(),
  });

  const p2 = bus.publish('counter.topic', {
    id: asUUID('e2'),
    topic: 'counter.topic',
    key: 'order-key-1',
    payload: { seq: 2 },
    timestamp: Date.now(),
  });

  const p3 = bus.publish('counter.topic', {
    id: asUUID('e3'),
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
  const bus = new EventBus({ backoffBaseMs: 5 });
  await bus.boot();

  bus.subscribe('failing.topic', () => {
    throw new Error('Subscriber intentional failure');
  });

  await bus.publish('failing.topic', {
    id: asUUID('evt-fail'),
    topic: 'failing.topic',
    key: 'fail-key',
    payload: { test: true },
    timestamp: Date.now(),
  });

  const deadLetters = bus.getDeadLetterQueue();
  assert.strictEqual(deadLetters.length, 1);
  assert.strictEqual(deadLetters[0].id, asUUID('evt-fail'));

  bus.clearDeadLetters();
  assert.strictEqual(bus.getDeadLetterQueue().length, 0);

  await bus.shutdown();
});

test('EventBus preserves strict sequential FIFO delivery across concurrent publishers', async () => {
  const bus = new EventBus({ maxQueueLengthPerKey: 10000 });
  await bus.boot();

  const totalKeys = 5;
  const eventsPerKey = 50;
  const receivedPerKey = new Map<string, number[]>();

  for (let k = 0; k < totalKeys; k++) {
    const key = `key-${k}`;
    receivedPerKey.set(key, []);
    bus.subscribe(`topic.${key}`, async (event: Event<{ seq: number }>) => {
      await new Promise((r) => setTimeout(r, 2));
      receivedPerKey.get(key)!.push(event.payload.seq);
    });
  }

  const promises: Promise<void>[] = [];
  for (let seq = 0; seq < eventsPerKey; seq++) {
    for (let k = 0; k < totalKeys; k++) {
      const key = `key-${k}`;
      promises.push(
        bus.publish(`topic.${key}`, {
          id: asUUID(`evt-${key}-${seq}`),
          topic: `topic.${key}`,
          key,
          payload: { seq },
          timestamp: Date.now(),
        })
      );
    }
  }

  await Promise.all(promises);

  for (let k = 0; k < totalKeys; k++) {
    const key = `key-${k}`;
    const received = receivedPerKey.get(key)!;
    assert.strictEqual(received.length, eventsPerKey);
    for (let i = 0; i < eventsPerKey; i++) {
      assert.strictEqual(received[i], i, `Key ${key} sequence mismatch at index ${i}`);
    }
  }

  await bus.shutdown();
});

test('EventBus cleans up per-key queues on drain and avoids memory leaks', async () => {
  const bus = new EventBus();
  await bus.boot();

  // Publish across 500 distinct keys
  for (let i = 0; i < 500; i++) {
    await bus.publish(`distinct.topic`, {
      id: asUUID(`evt-distinct-${i}`),
      topic: `distinct.topic`,
      key: `key-unique-${i}`,
      payload: { value: i },
      timestamp: Date.now(),
    });
  }

  // Internal queue map should have drained back to 0
  assert.strictEqual((bus as any)._keyQueues.size, 0);

  await bus.shutdown();
});

test('EventBus exposes processing/error counters via getStats (SRC-22)', async () => {
  const bus = new EventBus({ backoffBaseMs: 1, maxRetries: 1 });
  await bus.boot();

  bus.subscribe('ok.topic', () => { /* success */ });
  bus.subscribe('bad.topic', () => {
    throw new Error('boom');
  });

  await bus.publish('ok.topic', { id: asUUID('ok-1'), topic: 'ok.topic', key: 'k', payload: {}, timestamp: 0 });
  await bus.publish('bad.topic', { id: asUUID('bad-1'), topic: 'bad.topic', key: 'k', payload: {}, timestamp: 0 });

  const stats = bus.getStats();
  assert.ok(stats.processedCount >= 1, 'processedCount should reflect successful deliveries');
  assert.ok(stats.errorCount >= 1, 'errorCount should reflect failed deliveries');
  assert.ok(stats.deadLetterCount >= 1, 'failed event should be dead-lettered');

  await bus.shutdown();
});

test('EventBus shutdown terminates even under a self-sustaining producer (EX-6)', async () => {
  const bus = new EventBus({ shutdownDrainMs: 300 });
  await bus.boot();

  let count = 0;
  // Self-sustaining loop: each delivered event republishes another, which
  // previously kept the queue non-empty and wedged shutdown forever.
  bus.subscribe('loop', async () => {
    count++;
    try {
      await bus.publish('loop', { id: asUUID(`e${count}`), topic: 'loop', key: 'k', payload: {}, timestamp: 0 });
      await new Promise((r) => setTimeout(r, 1));
    } catch {
      // publish rejects once the bus stops accepting during shutdown
    }
  });
  bus.publish('loop', { id: asUUID('seed'), topic: 'loop', key: 'k', payload: {}, timestamp: 0 });
  await new Promise((r) => setTimeout(r, 50));

  const start = Date.now();
  const result = await Promise.race([
    bus.shutdown().then(() => 'completed'),
    new Promise((res) => setTimeout(() => res('HUNG'), 2000)),
  ]);
  const elapsed = Date.now() - start;

  assert.strictEqual(result, 'completed');
  assert.ok(elapsed < 1000, `shutdown should be bounded, took ${elapsed}ms`);

  await Promise.resolve();
});

test('EventBus retries with exponential backoff on subscriber errors before DLQ routing', async () => {
  let attemptCount = 0;
  const bus = new EventBus({ maxRetries: 3, backoffBaseMs: 15 });
  await bus.boot();

  bus.subscribe('retry.topic', () => {
    attemptCount++;
    throw new Error('Transient error');
  });

  const start = Date.now();
  await bus.publish('retry.topic', {
    id: asUUID('evt-retry-test'),
    topic: 'retry.topic',
    key: 'k1',
    payload: {},
    timestamp: Date.now(),
  });
  const elapsed = Date.now() - start;

  assert.strictEqual(attemptCount, 3);
  assert.strictEqual(bus.getDeadLetterQueue().length, 1);
  assert.strictEqual(elapsed >= 25, true, `Expected elapsed >= 25ms due to backoff, got ${elapsed}ms`);

  await bus.shutdown();
});
